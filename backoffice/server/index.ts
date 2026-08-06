import { Hono } from "hono";

import type { BackofficeDependencies } from "./dependencies.js";
import { createBackofficeAdminRoutes } from "./routes/admin.js";
import { createBackofficeAuthRoutes } from "./routes/auth.js";

export type { BackofficeDependencies } from "./dependencies.js";
export type { BackofficeEnvironment } from "./env.js";
export { loadBackofficeEnvironment } from "./env.js";
export { createBackofficeDependencies } from "./runtime.js";

/**
 * The backoffice API, mounted by the composition entries (domain-server/server.ts,
 * domain-server/dev-app.ts) under /backoffice — its own top-level prefix, outside the
 * app's /api subtree and the middleware registered there. All backoffice
 * server code lives here; the app in domain-server/ knows nothing about it beyond
 * that mount.
 */
export function createBackofficeRoutes(dependencies: BackofficeDependencies) {
  return new Hono()
    .route("/auth", createBackofficeAuthRoutes(dependencies))
    .route("/admin", createBackofficeAdminRoutes(dependencies));
}

export type BackofficeRoutes = ReturnType<typeof createBackofficeRoutes>;
