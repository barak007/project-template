import { createMiddleware } from "hono/factory";

import { AppError } from "../errors.js";

import type { AppBindings, RuntimeDependencies } from "./context.js";

export function requireAuthentication(dependencies: RuntimeDependencies) {
  return createMiddleware<AppBindings>(async (context, next) => {
    const session = await dependencies.auth.api.getSession({
      headers: context.req.raw.headers,
    });
    if (!session)
      throw new AppError(
        "AUTHENTICATION_REQUIRED",
        "Authentication is required",
        401,
      );
    context.set("session", session.session);
    context.set("user", session.user);
    await next();
  });
}
