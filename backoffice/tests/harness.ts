import { browserFetch } from "../../domain-client/tests/kit/browser-fetch.js";
import type { Database } from "../../domain-server/db/client.js";
import {
  asUser,
  createTestApp,
  createTestDatabase,
  createTestUser,
  jsonBody,
} from "../../domain-server/tests/helpers/harness.js";
import { createBackofficeCore, createMemoryHistory } from "../client/index.js";
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

const consoleBaseUrl = "http://backoffice.test";

/**
 * A fresh backoffice world for console (client-core) tests: its own database,
 * the backoffice test app mounted on it, and one tenant founded by `founder`.
 * `close()` tears the database down in `afterAll`.
 */
export async function createBackofficeConsoleWorld(options: {
  founder: string;
  tenantName: string;
}) {
  const { db, close } = await createTestDatabase();
  const { app } = createBackofficeTestApp(db);
  await createTestUser(db, options.founder);
  const created = await app.request(
    "/api/organizations",
    asUser(options.founder, jsonBody({ name: options.tenantName })),
  );
  if (created.status !== 201)
    throw new Error(
      `Founding the tenant failed with ${String(created.status)}`,
    );
  const { id: organizationId } = (await created.json()) as { id: string };

  /** Each console is an independent "browser": its own core and cookie jar. */
  function newConsole(initialPath = "/") {
    const history = createMemoryHistory(initialPath);
    const backoffice = createBackofficeCore({
      baseUrl: consoleBaseUrl,
      host: {
        fetch: browserFetch(async (input, init) =>
          app.request(
            input instanceof Request ? input : new URL(input, consoleBaseUrl),
            init,
          ),
        ),
      },
      history,
    });
    return { backoffice, history };
  }

  /** A console whose operator has already signed in as the backoffice admin. */
  async function signedInConsole(initialPath = "/") {
    const opened = newConsole(initialPath);
    await opened.backoffice.auth.signIn(backofficeAdminCredentials);
    if (opened.backoffice.getState().auth.status !== "authenticated")
      throw new Error("Backoffice sign-in failed");
    return opened;
  }

  return { organizationId, close, newConsole, signedInConsole };
}

export type BackofficeConsoleWorld = Awaited<
  ReturnType<typeof createBackofficeConsoleWorld>
>;
export type BackofficeConsole = ReturnType<
  BackofficeConsoleWorld["newConsole"]
>["backoffice"];

export function withCookie(
  cookie: string,
  init: RequestInit = {},
): RequestInit {
  return { ...init, headers: { cookie, ...(init.headers ?? {}) } };
}
