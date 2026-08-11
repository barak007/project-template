import { and, eq } from "drizzle-orm";

import type { Database } from "../db/client.js";
import type { ProjectLocation } from "../db/schema.js";
import { workSessions } from "../db/schema.js";
import { AppError } from "../errors.js";
import type { ProjectFiles } from "../git/project-files.js";

import { requireOrganizationPermission } from "./policy.js";

/**
 * Browsing what a session holds. Reads only, so `resource:read` — a member who
 * may see a session may read the code it opened on.
 */
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
 * Where the session's own clone lives — filtered on `organizationId` too, so a
 * session belonging to another organization is a `404` rather than a read.
 */
async function sessionProject(
  db: Database,
  userId: string,
  organizationId: string,
  workSessionId: string,
): Promise<ProjectLocation> {
  await requireOrganizationPermission(
    db,
    userId,
    organizationId,
    "resource:read",
  );
  const [row] = await db
    .select({ projectLocation: workSessions.projectLocation })
    .from(workSessions)
    .where(
      and(
        eq(workSessions.id, workSessionId),
        eq(workSessions.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!row) throw new AppError("NOT_FOUND", "Work session not found", 404);
  if (!row.projectLocation)
    throw new AppError(
      "VALIDATION_FAILED",
      "This session is still being prepared",
      400,
    );
  return row.projectLocation;
}
