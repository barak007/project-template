import { createRuntime } from "./runtime.js";

const runtime = await createRuntime();
const log = runtime.dependencies.log;
await runtime.queue.registerWorkers(
  runtime.dependencies.db,
  runtime.dependencies.projectBuilder,
);
log.info("Worker is accepting jobs");

let shuttingDown = false;
async function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info("Stopping worker", { signal });
  try {
    await Promise.race([
      Promise.allSettled([
        runtime.queue.stop(),
        runtime.client.end({ timeout: 5 }),
      ]),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Worker shutdown timed out")),
          runtime.environment.SHUTDOWN_TIMEOUT_MS,
        ),
      ),
    ]);
    process.exitCode = 0;
  } catch (error) {
    log.error("Worker shutdown failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  }
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
