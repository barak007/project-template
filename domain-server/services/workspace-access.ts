import { and, asc, eq } from "drizzle-orm";

import type { Database } from "../db/client.js";
import {
  organizationMembers,
  user,
  workspaces,
  workspaceSources,
  workspaceUserGrants,
} from "../db/schema.js";
import type { WorkspaceRole } from "../db/schema.js";
import { AppError } from "../errors.js";

import { requireWorkspacePermission } from "./policy.js";

/**
 * Who may reach one workspace, and how. Two separate levers: **visibility**
 * decides whether the organization at large can see it at all, and a **grant**
 * names one person and what they may do.
 *
 * Both are `workspace:manage`, which every organization owner and admin holds
 * on every workspace and a workspace's own manager holds on theirs — so a
 * member can run their own workspace's access without administering the
 * organization.
 */
export async function listGrants(
  db: Database,
  userId: string,
  organizationId: string,
  workspaceId: string,
) {
  await requireWorkspacePermission(
    db,
    userId,
    organizationId,
    workspaceId,
    "workspace:manage",
  );
  // Named, not just identified: a manager choosing who to grant cannot be asked
  // to recognise a user id.
  return db
    .select({
      workspaceId: workspaceUserGrants.workspaceId,
      userId: workspaceUserGrants.userId,
      role: workspaceUserGrants.role,
      name: user.name,
      email: user.email,
      createdAt: workspaceUserGrants.createdAt,
    })
    .from(workspaceUserGrants)
    .innerJoin(user, eq(user.id, workspaceUserGrants.userId))
    .where(eq(workspaceUserGrants.workspaceId, workspaceId))
    .orderBy(asc(workspaceUserGrants.createdAt));
}

export async function setWorkspaceVisibility(
  db: Database,
  userId: string,
  organizationId: string,
  workspaceId: string,
  visibility: "organization" | "restricted",
) {
  const yourRole = await requireWorkspacePermission(
    db,
    userId,
    organizationId,
    workspaceId,
    "workspace:manage",
  );
  const [workspace] = await db
    .update(workspaces)
    .set({ visibility, updatedAt: new Date() })
    .where(
      and(
        eq(workspaces.id, workspaceId),
        eq(workspaces.organizationId, organizationId),
      ),
    )
    .returning();
  if (!workspace) throw new AppError("NOT_FOUND", "Workspace not found", 404);
  // The whole workspace comes back, repositories included, so a caller replaces
  // the row it already has rather than re-reading the list.
  const links = await db
    .select({ sourceId: workspaceSources.sourceId })
    .from(workspaceSources)
    .where(eq(workspaceSources.workspaceId, workspaceId));
  return {
    ...workspace,
    sourceIds: links.map((link) => link.sourceId),
    yourRole,
  };
}

/** Grants access, or changes the access already granted. */
export async function putGrant(
  db: Database,
  actorUserId: string,
  organizationId: string,
  workspaceId: string,
  input: { userId: string; role: WorkspaceRole },
) {
  await requireWorkspacePermission(
    db,
    actorUserId,
    organizationId,
    workspaceId,
    "workspace:manage",
  );
  // A grant to somebody outside the organization would be access to a workspace
  // in an organization they cannot see — meaningless, and worth refusing loudly.
  const [membership] = await db
    .select({ userId: organizationMembers.userId })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, input.userId),
      ),
    )
    .limit(1);
  if (!membership)
    throw new AppError(
      "VALIDATION_FAILED",
      "That person is not a member of this organization",
      400,
    );

  const [grant] = await db
    .insert(workspaceUserGrants)
    .values({ workspaceId, userId: input.userId, role: input.role })
    .onConflictDoUpdate({
      target: [workspaceUserGrants.workspaceId, workspaceUserGrants.userId],
      set: { role: input.role },
    })
    .returning();
  if (!grant)
    throw new AppError("INTERNAL_ERROR", "Could not save the grant", 500);
  return named(db, grant);
}

export async function removeGrant(
  db: Database,
  actorUserId: string,
  organizationId: string,
  workspaceId: string,
  subjectUserId: string,
) {
  await requireWorkspacePermission(
    db,
    actorUserId,
    organizationId,
    workspaceId,
    "workspace:manage",
  );
  const [removed] = await db
    .delete(workspaceUserGrants)
    .where(
      and(
        eq(workspaceUserGrants.workspaceId, workspaceId),
        eq(workspaceUserGrants.userId, subjectUserId),
      ),
    )
    .returning({ userId: workspaceUserGrants.userId });
  if (!removed) throw new AppError("NOT_FOUND", "Grant not found", 404);
}

async function named(
  db: Database,
  grant: { workspaceId: string; userId: string; role: WorkspaceRole; createdAt: Date },
) {
  const [person] = await db
    .select({ name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, grant.userId))
    .limit(1);
  return {
    ...grant,
    name: person?.name ?? "",
    email: person?.email ?? "",
  };
}
