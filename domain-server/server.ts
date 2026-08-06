import { serve } from "@hono/node-server";

import {
  createBackofficeDependencies,
  createBackofficeRoutes,
} from "../backoffice/server/index.js";

import { createApp, type AppType } from "./app.js";
import { createRuntime } from "./runtime.js";

export type { AppType };

// Composition root: the one place (with domain-server/dev-app.ts) allowed to know both
// the app and the backoffice server, mounting the latter.
const runtime = await createRuntime();
const app = createApp(runtime.dependencies).route(
  "/backoffice",
  createBackofficeRoutes(createBackofficeDependencies(runtime.dependencies.db)),
);
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
