import { and, desc, eq, inArray } from "drizzle-orm";

import type { Database } from "../db/client.js";
import { sources, workspaceSources, workspaces } from "../db/schema.js";
import type { WorkspaceInput } from "../entities/workspace.js";
import { AppError } from "../errors.js";

import { requireOrganizationPermission } from "./policy.js";

async function validateSources(
  db: Database,
  organizationId: string,
  sourceIds: string[],
) {
  if (sourceIds.length === 0) return;
  const found = await db
    .select({ id: sources.id })
    .from(sources)
    .where(
      and(
        eq(sources.organizationId, organizationId),
        inArray(sources.id, sourceIds),
      ),
    );
  if (found.length !== new Set(sourceIds).size)
    throw new AppError(
      "VALIDATION_FAILED",
      "Every source must belong to the organization",
      400,
    );
}

async function withSourceIds(
  db: Database,
  rows: (typeof workspaces.$inferSelect)[],
) {
  if (rows.length === 0) return [];
  const links = await db
    .select()
    .from(workspaceSources)
    .where(
      inArray(
        workspaceSources.workspaceId,
        rows.map((row) => row.id),
      ),
    );
  return rows.map((row) => ({
    ...row,
    sourceIds: links
      .filter((link) => link.workspaceId === row.id)
      .map((link) => link.sourceId),
  }));
}

export async function listWorkspaces(
  db: Database,
  userId: string,
  organizationId: string,
) {
  await requireOrganizationPermission(
    db,
    userId,
    organizationId,
    "resource:read",
  );
  const rows = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.organizationId, organizationId))
    .orderBy(desc(workspaces.createdAt));
  return withSourceIds(db, rows);
}

export async function createWorkspace(
  db: Database,
  userId: string,
  organizationId: string,
  input: WorkspaceInput,
) {
  await requireOrganizationPermission(
    db,
    userId,
    organizationId,
    "resource:write",
  );
  await validateSources(db, organizationId, input.sourceIds);
  return db.transaction(async (transaction) => {
    const [workspace] = await transaction
      .insert(workspaces)
      .values({ name: input.name, organizationId })
      .returning();
    if (!workspace)
      throw new AppError("INTERNAL_ERROR", "Could not create workspace", 500);
    if (input.sourceIds.length > 0)
      await transaction.insert(workspaceSources).values(
        input.sourceIds.map((sourceId) => ({
          workspaceId: workspace.id,
          sourceId,
        })),
      );
    return { ...workspace, sourceIds: input.sourceIds };
  });
}

export async function updateWorkspace(
  db: Database,
  userId: string,
  organizationId: string,
  workspaceId: string,
  input: WorkspaceInput,
) {
  await requireOrganizationPermission(
    db,
    userId,
    organizationId,
    "resource:write",
  );
  await validateSources(db, organizationId, input.sourceIds);
  return db.transaction(async (transaction) => {
    const [workspace] = await transaction
      .update(workspaces)
      .set({ name: input.name, updatedAt: new Date() })
      .where(
        and(
          eq(workspaces.id, workspaceId),
          eq(workspaces.organizationId, organizationId),
        ),
      )
      .returning();
    if (!workspace) throw new AppError("NOT_FOUND", "Workspace not found", 404);
    await transaction
      .delete(workspaceSources)
      .where(eq(workspaceSources.workspaceId, workspaceId));
    if (input.sourceIds.length > 0)
      await transaction
        .insert(workspaceSources)
        .values(input.sourceIds.map((sourceId) => ({ workspaceId, sourceId })));
    return { ...workspace, sourceIds: input.sourceIds };
  });
}

export async function deleteWorkspace(
  db: Database,
  userId: string,
  organizationId: string,
  workspaceId: string,
) {
  await requireOrganizationPermission(
    db,
    userId,
    organizationId,
    "resource:write",
  );
  const [workspace] = await db
    .delete(workspaces)
    .where(
      and(
        eq(workspaces.id, workspaceId),
        eq(workspaces.organizationId, organizationId),
      ),
    )
    .returning({ id: workspaces.id });
  if (!workspace) throw new AppError("NOT_FOUND", "Workspace not found", 404);
}
