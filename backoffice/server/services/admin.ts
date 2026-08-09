import { generateRandomString, hashPassword } from "better-auth/crypto";
import { desc, eq } from "drizzle-orm";

import type { Database } from "../../../domain-server/db/client.js";
import {
  account,
  organizationMembers,
  organizations,
  sources,
  user,
  workSessions,
  workspaces,
} from "../../../domain-server/db/schema.js";
import { AppError } from "../../../domain-server/errors.js";
import type {
  CreateAdminOrganizationInput,
  CreateAdminUserInput,
} from "../entities/admin.js";

/** Same shape better-auth generates for its own ids. */
function generateId() {
  return generateRandomString(32, "a-z", "A-Z", "0-9");
}

// Authorization happens at the route boundary: the admin routes require the
// backoffice-admin session (../session.ts), so these functions receive
// pre-authorized calls.
export async function listAllUsers(db: Database) {
  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })
    .from(user)
    .orderBy(desc(user.createdAt));
}

/**
 * Creates an application user with an email/password credential. The hash
 * comes from better-auth's own crypto, so the user can sign in through the
 * app's regular better-auth flow.
 */
export async function createUser(db: Database, input: CreateAdminUserInput) {
  const passwordHash = await hashPassword(input.password);
  const userId = generateId();
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(user)
      .values({ id: userId, name: input.name, email: input.email })
      .returning({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });
    await tx.insert(account).values({
      id: generateId(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: passwordHash,
    });
    return created;
  });
}

export async function deleteUser(db: Database, userId: string) {
  // Sessions, credentials, memberships, data, and secrets cascade; created
  // work sessions restrict, which handleError surfaces as a 409 CONFLICT.
  const deleted = await db
    .delete(user)
    .where(eq(user.id, userId))
    .returning({ id: user.id });
  if (deleted.length === 0)
    throw new AppError("NOT_FOUND", "User not found", 404);
}

export async function listAllOrganizations(db: Database) {
  return db.select().from(organizations).orderBy(desc(organizations.createdAt));
}

export async function createOrganization(
  db: Database,
  input: CreateAdminOrganizationInput,
) {
  const [created] = await db
    .insert(organizations)
    .values({ name: input.name })
    .returning();
  return created;
}

export async function deleteOrganization(db: Database, organizationId: string) {
  await db.transaction(async (tx) => {
    // Work sessions RESTRICT workspace deletion, and Postgres checks that
    // before the organization cascade removes them — so clear them first.
    await tx
      .delete(workSessions)
      .where(eq(workSessions.organizationId, organizationId));
    const deleted = await tx
      .delete(organizations)
      .where(eq(organizations.id, organizationId))
      .returning({ id: organizations.id });
    if (deleted.length === 0)
      throw new AppError("NOT_FOUND", "Organization not found", 404);
  });
}

export async function getOrganizationDetail(
  db: Database,
  organizationId: string,
) {
  const [organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  if (!organization)
    throw new AppError("NOT_FOUND", "Organization not found", 404);

  const members = await db
    .select({
      userId: organizationMembers.userId,
      role: organizationMembers.role,
      name: user.name,
      email: user.email,
      createdAt: organizationMembers.createdAt,
    })
    .from(organizationMembers)
    .innerJoin(user, eq(user.id, organizationMembers.userId))
    .where(eq(organizationMembers.organizationId, organizationId));
  const organizationSources = await db
    .select({
      id: sources.id,
      name: sources.name,
      kind: sources.kind,
      createdAt: sources.createdAt,
      updatedAt: sources.updatedAt,
    })
    .from(sources)
    .where(eq(sources.organizationId, organizationId))
    .orderBy(desc(sources.createdAt));
  const organizationWorkspaces = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      createdAt: workspaces.createdAt,
      updatedAt: workspaces.updatedAt,
    })
    .from(workspaces)
    .where(eq(workspaces.organizationId, organizationId))
    .orderBy(desc(workspaces.createdAt));
  const organizationWorkSessions = await db
    .select({
      id: workSessions.id,
      workspaceId: workSessions.workspaceId,
      createdByUserId: workSessions.createdByUserId,
      status: workSessions.status,
      failureCode: workSessions.failureCode,
      createdAt: workSessions.createdAt,
      updatedAt: workSessions.updatedAt,
    })
    .from(workSessions)
    .where(eq(workSessions.organizationId, organizationId))
    .orderBy(desc(workSessions.createdAt));

  return {
    organization,
    members,
    sources: organizationSources,
    workspaces: organizationWorkspaces,
    workSessions: organizationWorkSessions,
  };
}
