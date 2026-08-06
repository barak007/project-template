import { describe, expect, it } from "vitest";

import { createAuth } from "../auth.js";
import { loadEnvironment } from "../config/env.js";
import { createDatabase } from "../db/client.js";

import { createTestDatabase } from "./helpers/harness.js";

const environment = loadEnvironment({
  NODE_ENV: "test",
  DATABASE_URL: "postgres://postgres:postgres@localhost:5432/app_test",
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  SECRETS_ENCRYPTION_KEY: Buffer.alloc(32).toString("base64"),
});

describe("wiring", () => {
  it("creates a database handle without connecting eagerly", async () => {
    const { db, client } = createDatabase(environment);
    expect(db).toBeDefined();
    await client.end({ timeout: 1 });
  });

  it("constructs the auth runtime against the app database", async () => {
    const { db, close } = await createTestDatabase();
    const auth = createAuth(db, environment);
    expect(typeof auth.handler).toBe("function");
    expect(typeof auth.api.getSession).toBe("function");
    await close();
  });
});
