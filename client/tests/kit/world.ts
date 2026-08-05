import { createApp } from "../../../src/app.js";
import { createAuth } from "../../../src/auth.js";
import { loadEnvironment } from "../../../src/config/env.js";
import {
  createTestDatabase,
  recordingJobs,
  testCipher,
} from "../../../tests/helpers/harness.js";
import { createClientCore } from "../../src/index.js";

import { browserFetch } from "./browser-fetch.js";

/**
 * A backend universe for client stories: one in-process server over its own
 * in-process database, with REAL Better Auth — sign-up, sign-in, and sign-out
 * exercise actual password hashing and session cookies. Each `newClient()` is
 * an independent "browser" (its own client core and cookie jar).
 */
export async function createWorld() {
  const baseUrl = "http://client.test";

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
  let personas = 0;

  const newClient = () =>
    createClientCore({
      baseUrl,
      fetch: browserFetch(async (input, init) => app.request(input, init)),
    });

  return {
    newClient,
    /** Persona shortcut: a client already signed up and signed in. */
    signedUpUser: async (name = `user-${(personas += 1)}`) => {
      const core = newClient();
      const credentials = {
        email: `${name}@example.test`,
        password: `password-for-${name}`,
      };
      await core.signUp({ ...credentials, name });
      if (core.getState().auth.status !== "authenticated")
        throw new Error(`Sign-up failed for persona ${name}`);
      return { core, credentials };
    },
    close,
  };
}

export type World = Awaited<ReturnType<typeof createWorld>>;
