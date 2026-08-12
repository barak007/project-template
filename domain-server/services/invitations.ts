import { and, desc, eq, sql } from "drizzle-orm";

import type { Database } from "../db/client.js";
import {
  organizationInvitations,
  organizationMembers,
  organizations,
  user,
} from "../db/schema.js";
import type {
  InvitationCreate,
  InvitationDecision,
} from "../entities/invitation.js";
import { AppError } from "../errors.js";
import type { Mailer } from "../mail/mailer.js";

import { requireOrganizationPermission } from "./policy.js";
import {
  deliverInvitationToInbox,
  findUserByEmail,
  markInvitationMessageRead,
} from "./user-messages.js";
import type { Recipient } from "./user-messages.js";

/**
 * Inviting someone to an organization. The invitation is the whole of what an
 * administrator can do: it names an address and a role, and grants nothing.
 * Membership is written when the invited person accepts it (`respondToInvitation`),
 * so nobody is put in an organization without agreeing to be there.
 */
export async function inviteMember(
  db: Database,
  mailer: Mailer,
  actorUserId: string,
  organizationId: string,
  input: InvitationCreate,
) {
  await requireOrganizationPermission(
    db,
    actorUserId,
    organizationId,
    "organization:manage",
  );
  const [organization] = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  if (!organization)
    throw new AppError("NOT_FOUND", "Organization not found", 404);

  const invited = await findUserByEmail(db, input.email);
  if (invited && (await isMember(db, organizationId, invited.id)))
    throw new AppError(
      "CONFLICT",
      "That person is already a member of this organization",
      409,
    );

  const invitation = await upsertPendingInvitation(
    db,
    organizationId,
    actorUserId,
    input,
  );
  if (invited)
    await deliverInvitationToInbox(db, {
      id: invitation.id,
      email: invitation.email,
    });

  const [inviter] = await db
    .select({ name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, actorUserId))
    .limit(1);
  await mailer.sendInvitation({
    to: invitation.email,
    organizationName: organization.name,
    invitedByName: inviter?.name ?? inviter?.email ?? "A colleague",
    role: invitation.role,
    hasAccount: invited !== undefined,
  });
  return invitation;
}

/** Every invitation ever sent for this organization, newest first. */
export async function listInvitations(
  db: Database,
  actorUserId: string,
  organizationId: string,
) {
  await requireOrganizationPermission(
    db,
    actorUserId,
    organizationId,
    "organization:manage",
  );
  return db
    .select()
    .from(organizationInvitations)
    .where(eq(organizationInvitations.organizationId, organizationId))
    .orderBy(desc(organizationInvitations.createdAt));
}

/** Taking back an offer nobody has answered yet. */
export async function revokeInvitation(
  db: Database,
  actorUserId: string,
  organizationId: string,
  invitationId: string,
) {
  await requireOrganizationPermission(
    db,
    actorUserId,
    organizationId,
    "organization:manage",
  );
  const [revoked] = await db
    .update(organizationInvitations)
    .set({ status: "revoked", respondedAt: new Date() })
    .where(
      and(
        eq(organizationInvitations.id, invitationId),
        eq(organizationInvitations.organizationId, organizationId),
        eq(organizationInvitations.status, "pending"),
      ),
    )
    .returning();
  if (!revoked) throw new AppError("NOT_FOUND", "Invitation not found", 404);
  return revoked;
}

/**
 * The invited person's answer, and the only place a membership is created.
 * Authorization is the address: the invitation was sent to an email, so it is
 * answerable by whoever proves they own that email by being signed in as it —
 * no token to leak, and an invitation forwarded to someone else is unusable.
 */
export async function respondToInvitation(
  db: Database,
  recipient: Recipient,
  invitationId: string,
  decision: InvitationDecision,
) {
  const [invitation] = await db
    .select()
    .from(organizationInvitations)
    .where(eq(organizationInvitations.id, invitationId))
    .limit(1);
  // Someone else's invitation is not theirs to see, let alone answer.
  if (invitation?.email.toLowerCase() !== recipient.email.toLowerCase())
    throw new AppError("NOT_FOUND", "Invitation not found", 404);
  if (invitation.status !== "pending")
    throw new AppError(
      "CONFLICT",
      "That invitation has already been answered",
      409,
    );

  const answered = await db.transaction(async (transaction) => {
    if (decision === "accept")
      await transaction
        .insert(organizationMembers)
        .values({
          organizationId: invitation.organizationId,
          userId: recipient.id,
          role: invitation.role,
        })
        // Already a member (two invitations, both accepted): the role they
        // agreed to most recently is the one they get.
        .onConflictDoUpdate({
          target: [
            organizationMembers.organizationId,
            organizationMembers.userId,
          ],
          set: { role: invitation.role },
        });
    const [updated] = await transaction
      .update(organizationInvitations)
      .set({
        status: decision === "accept" ? "accepted" : "declined",
        respondedAt: new Date(),
      })
      .where(
        and(
          eq(organizationInvitations.id, invitationId),
          eq(organizationInvitations.status, "pending"),
        ),
      )
      .returning();
    if (!updated)
      throw new AppError(
        "CONFLICT",
        "That invitation has already been answered",
        409,
      );
    return updated;
  });
  await markInvitationMessageRead(db, recipient.id, invitationId);
  return answered;
}

async function isMember(
  db: Database,
  organizationId: string,
  userId: string,
): Promise<boolean> {
  const [membership] = await db
    .select({ userId: organizationMembers.userId })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId),
      ),
    )
    .limit(1);
  return membership !== undefined;
}

/**
 * Re-inviting an address that is already waiting changes the role it was
 * offered rather than leaving two open offers — which is also what the partial
 * unique index on pending invitations enforces.
 */
async function upsertPendingInvitation(
  db: Database,
  organizationId: string,
  invitedByUserId: string,
  input: InvitationCreate,
) {
  const [waiting] = await db
    .select({ id: organizationInvitations.id })
    .from(organizationInvitations)
    .where(
      and(
        eq(organizationInvitations.organizationId, organizationId),
        eq(sql`lower(${organizationInvitations.email})`, input.email),
        eq(organizationInvitations.status, "pending"),
      ),
    )
    .limit(1);

  const [invitation] = waiting
    ? await db
        .update(organizationInvitations)
        .set({ role: input.role, invitedByUserId, updatedAt: new Date() })
        .where(eq(organizationInvitations.id, waiting.id))
        .returning()
    : await db
        .insert(organizationInvitations)
        .values({
          organizationId,
          email: input.email,
          role: input.role,
          invitedByUserId,
        })
        .returning();
  if (!invitation)
    throw new AppError("INTERNAL_ERROR", "Could not save the invitation", 500);
  return invitation;
}
