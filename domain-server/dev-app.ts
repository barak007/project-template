import {
  createBackofficeDependencies,
  createBackofficeRoutes,
} from "../backoffice/server/index.js";

import { createApp } from "./app.js";
import { createRuntime } from "./runtime.js";

// Dev-only entry: scripts/dev.ts loads this module through Vite's SSR module
// runner and re-executes it whenever a file under domain-server/ changes. Each execution
// owns its runtime; the loader calls dispose() on the previous instance before
// serving requests from the new one.
//
// This is a composition root: the one place (with domain-server/server.ts) allowed to
// know both the app and the backoffice server, mounting the latter.
const runtime = await createRuntime();

// Production runs the worker as its own process (worker.ts); in dev it lives
// here, because a queue nobody consumes leaves every session "preparing"
// forever and that is not a state anyone should have to debug locally.
await runtime.queue.registerWorkers(
  runtime.dependencies.db,
  runtime.dependencies.projectBuilder,
  runtime.dependencies.log,
);

export const port = runtime.environment.PORT;
export const app = createApp(runtime.dependencies).route(
  "/backoffice",
  createBackofficeRoutes(createBackofficeDependencies(runtime.dependencies.db)),
);

export async function dispose() {
  await Promise.allSettled([
    runtime.queue.stop(),
    runtime.client.end({ timeout: 5 }),
  ]);
}
