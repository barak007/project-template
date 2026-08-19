import { and, desc, eq } from "drizzle-orm";

import type { Database } from "../db/client.js";
import {
  organizationMembers,
  organizations,
  user,
  workspaces,
} from "../db/schema.js";
import type { OrganizationCreate } from "../entities/organization.js";
import { AppError } from "../errors.js";

import { requireOrganizationPermission } from "./policy.js";

export async function createOrganization(
  db: Database,
  userId: string,
  input: OrganizationCreate,
) {
  return db.transaction(async (transaction) => {
    const [organization] = await transaction
      .insert(organizations)
      .values(input)
      .returning();
    if (!organization)
      throw new AppError(
        "INTERNAL_ERROR",
        "Could not create organization",
        500,
      );
    await transaction
      .insert(organizationMembers)
      .values({ organizationId: organization.id, userId, role: "owner" });
    // Onboarding has no step for "create your first workspace": a new
    // organization starts with one named after itself, ready for repositories.
    await transaction
      .insert(workspaces)
      .values({ organizationId: organization.id, name: organization.name });
    return organization;
  });
}

export async function listOrganizations(db: Database, userId: string) {
  return db
    .select({
      id: organizations.id,
      name: organizations.name,
      createdAt: organizations.createdAt,
      updatedAt: organizations.updatedAt,
    })
    .from(organizations)
    .innerJoin(
      organizationMembers,
      eq(organizationMembers.organizationId, organizations.id),
    )
    .where(eq(organizationMembers.userId, userId))
    .orderBy(desc(organizations.createdAt));
}

export async function getOrganization(
  db: Database,
  userId: string,
  organizationId: string,
) {
  await requireOrganizationPermission(
    db,
    userId,
    organizationId,
    "organization:read",
  );
  const [organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  if (!organization)
    throw new AppError("NOT_FOUND", "Organization not found", 404);
  return organization;
}

/**
 * Who is in the organization, by name. Readable by everyone in it: "who else is
 * here" is not an administrator's secret, and a colleague has to be nameable for
 * anyone to grant them a workspace (services/workspace-access.ts). Changing a
 * role still needs `organization:manage`.
 */
export async function listMemberships(
  db: Database,
  userId: string,
  organizationId: string,
) {
  await requireOrganizationPermission(
    db,
    userId,
    organizationId,
    "organization:read",
  );
  return db
    .select({
      organizationId: organizationMembers.organizationId,
      userId: organizationMembers.userId,
      role: organizationMembers.role,
      name: user.name,
      email: user.email,
      createdAt: organizationMembers.createdAt,
    })
    .from(organizationMembers)
    .innerJoin(user, eq(user.id, organizationMembers.userId))
    .where(eq(organizationMembers.organizationId, organizationId));
}

/**
 * Changes what an existing member may do. It cannot add one: joining an
 * organization is an invitation the invited person accepts (services/invitations.ts),
 * so an unknown user id here is a `404` rather than a new membership.
 */
export async function changeMemberRole(
  db: Database,
  actorUserId: string,
  organizationId: string,
  input: { userId: string; role: "owner" | "admin" | "member" },
) {
  await requireOrganizationPermission(
    db,
    actorUserId,
    organizationId,
    "organization:manage",
  );
  const [membership] = await db
    .update(organizationMembers)
    .set({ role: input.role })
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, input.userId),
      ),
    )
    .returning();
  if (!membership)
    throw new AppError(
      "NOT_FOUND",
      "That person is not a member of this organization",
      404,
    );
  const [person] = await db
    .select({ name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, membership.userId))
    .limit(1);
  return { ...membership, name: person?.name ?? "", email: person?.email ?? "" };
}
