import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import type { Database } from "../db/client.js";
import { workSessions, workspaces } from "../db/schema.js";
import type { ProgressStep, SourceSnapshot } from "../db/schema.js";
import { gitSourceConfigSchema } from "../entities/source.js";
import { AppError } from "../errors.js";
import type {
  ProjectRepository,
  ReportStep,
  WorkspaceProjectBuilder,
} from "../git/project-builder.js";
import type { Logger } from "../logging.js";
import { silentLogger } from "../logging.js";

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

/**
 * Prepares a session: the workspace's project first — built once and reconciled
 * against the workspace afterwards — then a clone of it for this session.
 *
 * Progress is written to the session as it happens, so "what is it doing right
 * now" is a question the API can answer while this is still running.
 */
export async function materializeWorkSession(
  db: Database,
  projectBuilder: WorkspaceProjectBuilder,
  input: MaterializeWorkSessionJob,
  log: Logger = silentLogger,
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
    log.debug("work session was already claimed", {
      workSessionId: job.workSessionId,
      status: existing.status,
    });
    return existing;
  }

  const sessionLog = log.child({ workSessionId: claimed.id });
  const started = Date.now();
  const branch = sessionBranch(claimed.id);
  const report = reporter(db, claimed.id, sessionLog);
  let location;
  try {
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, claimed.workspaceId))
      .limit(1);
    if (!workspace) throw new AppError("NOT_FOUND", "Workspace not found", 404);

    // The snapshot, not the live sources: it is the config this session froze.
    const repositories = gitRepositories(claimed.sourcesSnapshot);
    sessionLog.info("preparing session", {
      workspace: workspace.name,
      repositories: repositories.length,
      branch,
    });

    const project = await projectBuilder.ensureWorkspaceProject({
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      repositories,
      report,
    });
    // Recorded before the clone, so a failed session still leaves the workspace
    // pointing at the project that now exists.
    await db
      .update(workspaces)
      .set({ projectLocation: project, updatedAt: new Date() })
      .where(eq(workspaces.id, workspace.id));

    location = await projectBuilder.cloneForSession({
      project,
      workSessionId: claimed.id,
      branch,
      report,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    sessionLog.error("session failed", { ms: Date.now() - started, reason });
    await report("Failed", reason);
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
  sessionLog.info("session ready", {
    ms: Date.now() - started,
    path: location.kind === "local" ? location.path : location.prefix,
  });
  return ready;
}

/**
 * Appends one step to the session's progress, in the database, as it happens.
 * `jsonb ||` rather than a read-modify-write so a concurrent update cannot lose
 * a step, and a failure to record progress never fails the session it describes.
 */
function reporter(
  db: Database,
  workSessionId: string,
  log: Logger,
): ReportStep {
  return async (step, detail) => {
    log.info(step, detail === undefined ? undefined : { detail });
    const entry: ProgressStep = {
      step,
      at: new Date().toISOString(),
      ...(detail === undefined ? {} : { detail }),
    };
    try {
      await db
        .update(workSessions)
        .set({
          progress: sql`${workSessions.progress} || ${JSON.stringify([entry])}::jsonb`,
          updatedAt: new Date(),
        })
        .where(eq(workSessions.id, workSessionId));
    } catch (error) {
      log.warn("could not record progress", {
        step,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  };
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
