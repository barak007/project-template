import { describe, expect, it } from "vitest";

import { loadEnvironment } from "../src/config/env.js";

const valid = {
  NODE_ENV: "test",
  DATABASE_URL: "postgres://postgres:postgres@localhost:5432/app_test",
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  TRUSTED_ORIGINS: "http://localhost:3000,http://localhost:3001",
  SECRETS_ENCRYPTION_KEY: Buffer.alloc(32).toString("base64"),
};

describe("environment", () => {
  it("parses defaults and origins", () => {
    expect(loadEnvironment(valid).TRUSTED_ORIGINS).toHaveLength(2);
  });

  it("reports only invalid field names, not secret values", () => {
    expect(() =>
      loadEnvironment({ ...valid, BETTER_AUTH_SECRET: "short" }),
    ).toThrow(/BETTER_AUTH_SECRET/);
  });
});
