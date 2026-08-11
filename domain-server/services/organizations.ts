import { desc, eq } from "drizzle-orm";

import type { Database } from "../db/client.js";
import {
  organizationMembers,
  organizations,
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

export async function listMemberships(
  db: Database,
  userId: string,
  organizationId: string,
) {
  await requireOrganizationPermission(
    db,
    userId,
    organizationId,
    "organization:manage",
  );
  return db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.organizationId, organizationId));
}

export async function putMembership(
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
    .insert(organizationMembers)
    .values({ organizationId, ...input })
    .onConflictDoUpdate({
      target: [organizationMembers.organizationId, organizationMembers.userId],
      set: { role: input.role },
    })
    .returning();
  if (!membership)
    throw new AppError("INTERNAL_ERROR", "Could not save membership", 500);
  return membership;
}
