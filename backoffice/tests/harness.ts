import type { Database } from "../../domain-server/db/client.js";
import { createTestApp } from "../../domain-server/tests/helpers/harness.js";
import {
  createBackofficeRoutes,
  loadBackofficeEnvironment,
} from "../server/index.js";
import type {
  BackofficeDependencies,
  BackofficeEnvironment,
} from "../server/index.js";

export const backofficeAdminCredentials = {
  email: "bo-admin@example.test",
  password: "backoffice-password",
};

// hashPassword(backofficeAdminCredentials.password), precomputed so building
// a test app stays synchronous and cheap.
export const backofficeAdminPasswordHash =
  "v1.UuSdE1nxhWZc8kVHFebeOA.8o-KHwmdG_TZ-A0NaXekqEdEbxmu7RqHuv9e3K-xiOlCmrHHL2KGjOdqdnxx5voGbxPGSTC-5BEkzJsWajBrpA";

/** A valid backoffice environment; by default the admin is configured. */
export function backofficeTestEnvironment(
  overrides: Partial<Record<string, string>> = {},
): BackofficeEnvironment {
  return loadBackofficeEnvironment({
    NODE_ENV: "test",
    BETTER_AUTH_SECRET: "test-harness-secret".padEnd(32, "!"),
    BACKOFFICE_ADMIN_EMAIL: backofficeAdminCredentials.email,
    BACKOFFICE_ADMIN_PASSWORD_HASH: backofficeAdminPasswordHash,
    ...overrides,
  });
}

/**
 * The application test app (tests/helpers/harness.ts) with the backoffice
 * routes mounted the same way the real entries do. `persistEnvironment` is a
 * recorder so setup tests can assert what would be written to .env.
 */
export function createBackofficeTestApp(
  db: Database,
  overrides: Partial<BackofficeDependencies> = {},
) {
  const persisted: Record<string, string>[] = [];
  const { app } = createTestApp(db);
  const composed = app.route(
    "/backoffice",
    createBackofficeRoutes({
      db,
      environment: backofficeTestEnvironment(),
      persistEnvironment: (values) => {
        persisted.push(values);
        return Promise.resolve();
      },
      ...overrides,
    }),
  );
  return { app: composed, persisted };
}

type TestApp = ReturnType<typeof createBackofficeTestApp>["app"];

/** Signs in as the backoffice admin and returns the session cookie header. */
export async function backofficeSessionCookie(app: TestApp): Promise<string> {
  const response = await app.request("/backoffice/auth/sign-in", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(backofficeAdminCredentials),
  });
  if (response.status !== 200)
    throw new Error(
      `Backoffice sign-in failed with ${String(response.status)}`,
    );
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new Error("Backoffice sign-in returned no cookie");
  return cookie;
}

export function withCookie(
  cookie: string,
  init: RequestInit = {},
): RequestInit {
  return { ...init, headers: { cookie, ...(init.headers ?? {}) } };
}
