import { and, desc, eq, isNull, sql } from "drizzle-orm";

import type { Database } from "../db/client.js";
import {
  organizationInvitations,
  organizations,
  user,
  userMessages,
} from "../db/schema.js";

/** Whoever is asking: an inbox is addressed to an identity and an address. */
export type Recipient = { id: string; email: string };

/**
 * The signed-in user's inbox. Reading it delivers first: an invitation sent to
 * an address that had no account yet has no message row, and this is where it
 * gets one — so signing up is enough to find what was waiting, with no hook
 * into sign-up and nothing to reconcile later.
 */
export async function listUserMessages(db: Database, recipient: Recipient) {
  await deliverPendingInvitations(db, recipient);
  return db
    .select({
      id: userMessages.id,
      kind: userMessages.kind,
      readAt: userMessages.readAt,
      createdAt: userMessages.createdAt,
      invitation: {
        id: organizationInvitations.id,
        organizationId: organizationInvitations.organizationId,
        organizationName: organizations.name,
        role: organizationInvitations.role,
        status: organizationInvitations.status,
        invitedByName: user.name,
      },
    })
    .from(userMessages)
    .innerJoin(
      organizationInvitations,
      eq(organizationInvitations.id, userMessages.invitationId),
    )
    .innerJoin(
      organizations,
      eq(organizations.id, organizationInvitations.organizationId),
    )
    .innerJoin(user, eq(user.id, organizationInvitations.invitedByUserId))
    .where(eq(userMessages.userId, recipient.id))
    .orderBy(desc(userMessages.createdAt));
}

/**
 * Puts an invitation in its recipient's inbox, if that address has an account.
 * Returns whether it did — an invitation to a stranger is still a valid
 * invitation, it simply waits for them to sign up.
 */
export async function deliverInvitationToInbox(
  db: Database,
  invitation: { id: string; email: string },
): Promise<boolean> {
  const recipient = await findUserByEmail(db, invitation.email);
  if (!recipient) return false;
  await insertInvitationMessage(db, recipient.id, invitation.id);
  return true;
}

/** An answered invitation is not news any more. */
export async function markInvitationMessageRead(
  db: Database,
  userId: string,
  invitationId: string,
) {
  await db
    .update(userMessages)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(userMessages.userId, userId),
        eq(userMessages.invitationId, invitationId),
        isNull(userMessages.readAt),
      ),
    );
}

export async function findUserByEmail(db: Database, email: string) {
  const [found] = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(eq(sql`lower(${user.email})`, email.toLowerCase()))
    .limit(1);
  return found;
}

/** Every pending invitation for this address that is not in the inbox yet. */
async function deliverPendingInvitations(db: Database, recipient: Recipient) {
  const waiting = await db
    .select({ id: organizationInvitations.id })
    .from(organizationInvitations)
    .where(
      and(
        eq(
          sql`lower(${organizationInvitations.email})`,
          recipient.email.toLowerCase(),
        ),
        eq(organizationInvitations.status, "pending"),
      ),
    );
  for (const invitation of waiting)
    await insertInvitationMessage(db, recipient.id, invitation.id);
}

function insertInvitationMessage(
  db: Database,
  userId: string,
  invitationId: string,
) {
  return db
    .insert(userMessages)
    .values({ userId, kind: "organization-invitation", invitationId })
    .onConflictDoNothing({
      target: [userMessages.userId, userMessages.invitationId],
    });
}
