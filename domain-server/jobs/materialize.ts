import { and, eq } from "drizzle-orm";
import { z } from "zod";

import type { Database } from "../db/client.js";
import { workSessions } from "../db/schema.js";
import { AppError } from "../errors.js";

export const MATERIALIZE_WORK_SESSION_QUEUE = "work-session.materialize";
export const MATERIALIZE_WORK_SESSION_DEAD_LETTER =
  "work-session.materialize.dead-letter";
export const materializeWorkSessionJobSchema = z.object({
  workSessionId: z.uuid(),
});
export type MaterializeWorkSessionJob = z.infer<
  typeof materializeWorkSessionJobSchema
>;

export async function materializeWorkSession(
  db: Database,
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

  // Source-specific materializers are an application extension point. The durable
  // snapshot is complete before this job is queued, so success is atomic to expose.
  const [ready] = await db
    .update(workSessions)
    .set({ status: "ready", failureCode: null, updatedAt: new Date() })
    .where(eq(workSessions.id, job.workSessionId))
    .returning();
  return ready;
}
