import { serve } from "@hono/node-server";

import { createApp, type AppType } from "./app.js";
import { createRuntime } from "./runtime.js";

export type { AppType };

const runtime = await createRuntime();
const app: AppType = createApp(runtime.dependencies);
const server = serve(
  { fetch: app.fetch, port: runtime.environment.PORT },
  (info) => {
    console.info(`API listening on http://localhost:${String(info.port)}`);
  },
);

let shuttingDown = false;
async function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`Received ${signal}; shutting down`);

  const closeServer = new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  const cleanup = Promise.allSettled([
    closeServer,
    runtime.queue.stop(),
    runtime.client.end({ timeout: 5 }),
  ]);
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error("Graceful shutdown timed out")),
      runtime.environment.SHUTDOWN_TIMEOUT_MS,
    ),
  );
  try {
    await Promise.race([cleanup, timeout]);
    process.exitCode = 0;
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
