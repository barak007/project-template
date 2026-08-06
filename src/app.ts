import { Hono } from "hono";

import { handleError } from "./errors.js";
import type { AppBindings, RuntimeDependencies } from "./http/context.js";
import { createDomainRoutes } from "./routes/domain.js";

export function createApp(dependencies: RuntimeDependencies) {
  const app = new Hono<AppBindings>()
    .get("/health", (context) => context.json({ status: "ok" as const }, 200))
    .get("/ready", async (context) => {
      try {
        await dependencies.ready();
        return context.json({ status: "ready" as const }, 200);
      } catch {
        return context.json(
          {
            error: {
              code: "NOT_READY",
              message: "A startup dependency is unavailable",
            },
          },
          503,
        );
      }
    })
    .on(["GET", "POST"], "/api/auth/*", (context) =>
      dependencies.auth.handler(context.req.raw),
    )
    .route("/api", createDomainRoutes(dependencies));

  app.notFound((context) =>
    context.json(
      { error: { code: "NOT_FOUND", message: "Route not found" } },
      404,
    ),
  );
  app.onError((error, context) => {
    const response = handleError(error, context);
    // Expected client failures (4xx, mapped conflicts) are not incidents.
    if (response.status === 500) dependencies.reportError(error);
    return response;
  });
  return app;
}

export type AppType = ReturnType<typeof createApp>;
