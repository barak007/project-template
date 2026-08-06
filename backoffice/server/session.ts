import type { Context } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";

import { AppError } from "../../src/errors.js";

import type { BackofficeDependencies } from "./dependencies.js";
import type { BackofficeEnvironment } from "./env.js";

const COOKIE_NAME = "backoffice_session";
const SESSION_TTL_SECONDS = 12 * 60 * 60;

/** The cookie value is the session's expiry; the signature makes it trusted. */
export async function issueBackofficeSession(
  context: Context,
  environment: BackofficeEnvironment,
): Promise<void> {
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  await setSignedCookie(
    context,
    COOKIE_NAME,
    String(expiresAt),
    environment.BETTER_AUTH_SECRET,
    {
      httpOnly: true,
      sameSite: "Lax",
      path: "/",
      secure: environment.NODE_ENV === "production",
      maxAge: SESSION_TTL_SECONDS,
    },
  );
}

export async function hasBackofficeSession(
  context: Context,
  environment: BackofficeEnvironment,
): Promise<boolean> {
  const value = await getSignedCookie(
    context,
    environment.BETTER_AUTH_SECRET,
    COOKIE_NAME,
  );
  return typeof value === "string" && Number(value) > Date.now();
}

export function clearBackofficeSession(context: Context): void {
  deleteCookie(context, COOKIE_NAME, { path: "/" });
}

export function requireBackofficeAdmin(dependencies: BackofficeDependencies) {
  return createMiddleware(async (context, next) => {
    if (!(await hasBackofficeSession(context, dependencies.environment)))
      throw new AppError(
        "AUTHENTICATION_REQUIRED",
        "Backoffice sign-in is required",
        401,
      );
    await next();
  });
}
