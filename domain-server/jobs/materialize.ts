import { and, eq } from "drizzle-orm";
import { z } from "zod";

import type { Database } from "../db/client.js";
import { workSessions, workspaces } from "../db/schema.js";
import type { SourceSnapshot } from "../db/schema.js";
import { gitSourceConfigSchema } from "../entities/source.js";
import { AppError } from "../errors.js";
import type {
  ProjectRepository,
  WorkspaceProjectBuilder,
} from "../git/project-builder.js";

export const MATERIALIZE_WORK_SESSION_QUEUE = "work-session.materialize";
export const MATERIALIZE_WORK_SESSION_DEAD_LETTER =
  "work-session.materialize.dead-letter";
export const materializeWorkSessionJobSchema = z.object({
  workSessionId: z.uuid(),
});
export type MaterializeWorkSessionJob = z.infer<
  typeof materializeWorkSessionJobSchema
>;

/** Every session works on its own branch, named after the session itself. */
export function sessionBranch(workSessionId: string): string {
  return `session/${workSessionId.slice(0, 8)}`;
}

export async function materializeWorkSession(
  db: Database,
  projectBuilder: WorkspaceProjectBuilder,
  input: MaterializeWorkSessionJob,
) {
  const job = materializeWorkSessionJobSchema.parse(input);
  const [claimed] = await db
    .update(workSessions)
    .set({ status: "materializing", updatedAt: new Date() })
    .where(
      and(
        eq(workSessions.id, job.workSessionId),
        eq(workSessions.status, "pending"),
      ),
    )
    .returning();

  // Already-ready work makes retries idempotent; another worker claiming it is also safe.
  if (!claimed) {
    const [existing] = await db
      .select()
      .from(workSessions)
      .where(eq(workSessions.id, job.workSessionId))
      .limit(1);
    if (!existing)
      throw new AppError("NOT_FOUND", "Work session not found", 404);
    return existing;
  }

  const branch = sessionBranch(claimed.id);
  let location;
  try {
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, claimed.workspaceId))
      .limit(1);
    location = await projectBuilder.build({
      workSessionId: claimed.id,
      workspaceName: workspace?.name ?? "workspace",
      // The snapshot, not the live sources: it is the config this session froze.
      repositories: gitRepositories(claimed.sourcesSnapshot),
      branch,
    });
  } catch (error) {
    await db
      .update(workSessions)
      .set({
        status: "failed",
        failureCode: "PROJECT_BUILD_FAILED",
        updatedAt: new Date(),
      })
      .where(eq(workSessions.id, claimed.id));
    throw error;
  }

  const [ready] = await db
    .update(workSessions)
    .set({
      status: "ready",
      projectBranch: branch,
      projectLocation: location,
      failureCode: null,
      updatedAt: new Date(),
    })
    .where(eq(workSessions.id, claimed.id))
    .returning();
  return ready;
}

/**
 * The git sources, as the builder needs them. A snapshot config that no longer
 * parses is skipped rather than failing the session — it can only come from a
 * source written before the shape was validated.
 */
function gitRepositories(snapshot: SourceSnapshot[]): ProjectRepository[] {
  const repositories: ProjectRepository[] = [];
  for (const source of snapshot) {
    if (source.kind !== "git") continue;
    const config = gitSourceConfigSchema.safeParse(source.config);
    if (!config.success) continue;
    repositories.push({
      name: source.name,
      remote: config.data.remote,
      ...(config.data.ref ? { ref: config.data.ref } : {}),
    });
  }
  return repositories;
}
