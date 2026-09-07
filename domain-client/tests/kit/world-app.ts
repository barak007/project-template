import { createAuth } from "../../../domain-server/auth.js";
import { loadEnvironment } from "../../../domain-server/config/env.js";
import {
  createTestApp,
  createTestDatabase,
} from "../../../domain-server/tests/helpers/harness.js";

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
  // The server harness's stub world, with the one override that matters here:
  // real Better Auth. Its recording mailer already keeps invitations in-app;
  // whether mail left the building is the server's own test
  // (tests/invitation-routes.test.ts).
  const { app } = createTestApp(db, { auth: createAuth(db, environment) });

  return {
    app: {
      fetch: (request) => app.fetch(request),
      request: (input, init) =>
        app.fetch(
          input instanceof Request
            ? input
            : new Request(new URL(input, baseUrl), init),
        ),
    },
    close,
  };
}
