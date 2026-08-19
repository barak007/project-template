import { and, eq } from "drizzle-orm";

import type { Database } from "../db/client.js";
import type { ProjectLocation } from "../db/schema.js";
import { workspaces, workSessions } from "../db/schema.js";
import { AppError } from "../errors.js";
import type { ProjectFiles } from "../git/project-files.js";

import { requireWorkspacePermission } from "./policy.js";

/**
 * Reading a git project this organization owns — either a **workspace's**
 * project, the template holding its repositories as submodules, or a
 * **session's** clone of it. One module because the two differ only in which row
 * says where the project is; everything after that is the same read.
 *
 * Reads only, so `workspace:read` in both cases — a session's files through the
 * workspace it came from: whoever may see a workspace may read the code it works
 * on, and whoever may not see it cannot reach its sessions either.
 */
export async function listWorkspaceProjectDirectory(
  db: Database,
  projectFiles: ProjectFiles,
  userId: string,
  organizationId: string,
  workspaceId: string,
  path: string,
) {
  const location = await workspaceProject(
    db,
    userId,
    organizationId,
    workspaceId,
  );
  return projectFiles.listDirectory(location, path);
}

export async function readWorkspaceProjectFile(
  db: Database,
  projectFiles: ProjectFiles,
  userId: string,
  organizationId: string,
  workspaceId: string,
  path: string,
) {
  const location = await workspaceProject(
    db,
    userId,
    organizationId,
    workspaceId,
  );
  return projectFiles.readFile(location, path);
}

export async function listWorkSessionDirectory(
  db: Database,
  projectFiles: ProjectFiles,
  userId: string,
  organizationId: string,
  workSessionId: string,
  path: string,
) {
  const location = await sessionProject(
    db,
    userId,
    organizationId,
    workSessionId,
  );
  return projectFiles.listDirectory(location, path);
}

export async function readWorkSessionFile(
  db: Database,
  projectFiles: ProjectFiles,
  userId: string,
  organizationId: string,
  workSessionId: string,
  path: string,
) {
  const location = await sessionProject(
    db,
    userId,
    organizationId,
    workSessionId,
  );
  return projectFiles.readFile(location, path);
}

/**
 * Where the workspace's own project lives. It is built by the first session, so
 * a workspace nobody has opened a session on has nothing to read yet.
 */
async function workspaceProject(
  db: Database,
  userId: string,
  organizationId: string,
  workspaceId: string,
): Promise<ProjectLocation> {
  await requireWorkspacePermission(
    db,
    userId,
    organizationId,
    workspaceId,
    "workspace:read",
  );
  const [row] = await db
    .select({ projectLocation: workspaces.projectLocation })
    .from(workspaces)
    .where(
      and(
        eq(workspaces.id, workspaceId),
        eq(workspaces.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!row) throw new AppError("NOT_FOUND", "Workspace not found", 404);
  if (!row.projectLocation)
    throw new AppError(
      "VALIDATION_FAILED",
      "This workspace's project is built by its first session",
      400,
    );
  return row.projectLocation;
}

/**
 * Where the session's own clone lives — filtered on `organizationId` too, so a
 * session belonging to another organization is a `404` rather than a read.
 */
async function sessionProject(
  db: Database,
  userId: string,
  organizationId: string,
  workSessionId: string,
): Promise<ProjectLocation> {
  const [row] = await db
    .select({
      workspaceId: workSessions.workspaceId,
      projectLocation: workSessions.projectLocation,
    })
    .from(workSessions)
    .where(
      and(
        eq(workSessions.id, workSessionId),
        eq(workSessions.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!row) throw new AppError("NOT_FOUND", "Work session not found", 404);
  // The permission lives on the workspace the session was opened from.
  await requireWorkspacePermission(
    db,
    userId,
    organizationId,
    row.workspaceId,
    "workspace:read",
  );
  if (!row.projectLocation)
    throw new AppError(
      "VALIDATION_FAILED",
      "This session is still being prepared",
      400,
    );
  return row.projectLocation;
}
