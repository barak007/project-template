import { eq } from "drizzle-orm";

import { createApp } from "../../../src/app.js";
import { createAuth } from "../../../src/auth.js";
import { loadEnvironment } from "../../../src/config/env.js";
import { platformAdmins, user } from "../../../src/db/schema.js";
import {
  createTestDatabase,
  recordingJobs,
  testCipher,
} from "../../../tests/helpers/harness.js";

export const grantPlatformAdminPath = "/test-kit/platform-admins";

// The kit only serves and dispatches requests, so this deliberately narrow
// shape keeps the app's full route-tree type (which makes tsc blow up with
// "excessively deep" when reflected through ReturnType) out of the kit.
export type WorldApp = {
  app: {
    fetch: (request: Request) => Response | Promise<Response>;
    request: (
      input: string | URL | Request,
      init?: RequestInit,
    ) => Response | Promise<Response>;
  };
  close: () => Promise<void>;
};

/**
 * The backend universe for client stories: the real application over an
 * in-process database, with REAL Better Auth — sign-up, sign-in, and sign-out
 * exercise actual password hashing and session cookies.
 */
export async function createWorldApp(baseUrl: string): Promise<WorldApp> {
  const environment = loadEnvironment({
    NODE_ENV: "test",
    DATABASE_URL: "postgres://unused:unused@localhost:5432/unused_test",
    BETTER_AUTH_SECRET: "client-world-secret".padEnd(32, "!"),
    BETTER_AUTH_URL: baseUrl,
    SECRETS_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  });

  const { db, close } = await createTestDatabase();
  const app = createApp({
    db,
    auth: createAuth(db, environment),
    cipher: testCipher,
    jobs: recordingJobs().jobs,
    reportError: () => undefined,
    ready: () => Promise.resolve(),
  });

  // Test-kit-only escape hatch: granting platform admin has no production
  // endpoint (operators run `pnpm admin:grant`), so the world intercepts it
  // in front of the untouched production app.
  const grantPlatformAdmin = async (request: Request): Promise<Response> => {
    const { email } = (await request.json()) as { email: string };
    const [target] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);
    if (!target)
      return Response.json({ error: "unknown user" }, { status: 404 });
    await db
      .insert(platformAdmins)
      .values({ userId: target.id })
      .onConflictDoNothing();
    return Response.json({ granted: true }, { status: 200 });
  };
  const dispatch = (request: Request) =>
    request.method === "POST" &&
    new URL(request.url).pathname === grantPlatformAdminPath
      ? grantPlatformAdmin(request)
      : app.fetch(request);

  return {
    app: {
      fetch: dispatch,
      request: (input, init) =>
        dispatch(
          input instanceof Request
            ? input
            : new Request(new URL(input, baseUrl), init),
        ),
    },
    close,
  };
}
