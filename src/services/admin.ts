import { desc, eq } from "drizzle-orm";

import type { Database } from "../db/client.js";
import {
  organizationMembers,
  organizations,
  sources,
  user,
  workSessions,
  workspaces,
} from "../db/schema.js";
import { AppError } from "../errors.js";

import { requirePlatformAdmin } from "./policy.js";

export async function listAllUsers(db: Database, userId: string) {
  await requirePlatformAdmin(db, userId);
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

export async function listAllOrganizations(db: Database, userId: string) {
  await requirePlatformAdmin(db, userId);
  return db.select().from(organizations).orderBy(desc(organizations.createdAt));
}

export async function getOrganizationDetail(
  db: Database,
  userId: string,
  organizationId: string,
) {
  await requirePlatformAdmin(db, userId);
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
