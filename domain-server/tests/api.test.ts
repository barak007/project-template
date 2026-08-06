import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import type { RuntimeDependencies } from "../http/context.js";

function dependencies(
  overrides: Partial<RuntimeDependencies> = {},
): RuntimeDependencies {
  return {
    auth: {
      api: { getSession: () => Promise.resolve(null) },
      handler: () => Promise.resolve(new Response()),
    },
    cipher: {},
    db: {},
    jobs: {},
    reportError: () => undefined,
    ready: () => Promise.resolve(),
    ...overrides,
  } as unknown as RuntimeDependencies;
}

describe("API", () => {
  it("exposes liveness and readiness", async () => {
    const app = createApp(dependencies());
    expect(await (await app.request("/health")).json()).toEqual({
      status: "ok",
    });
    expect((await app.request("/ready")).status).toBe(200);
  });

  it("does not leak readiness errors", async () => {
    const app = createApp(
      dependencies({
        ready: () => Promise.reject(new Error("password=secret")),
      }),
    );
    const response = await app.request("/ready");
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("password=secret");
  });

  it("requires authentication for domain routes", async () => {
    const response =
      await createApp(dependencies()).request("/api/organizations");
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: {
        code: "AUTHENTICATION_REQUIRED",
        message: "Authentication is required",
      },
    });
  });

  it("uses the standard not-found envelope", async () => {
    const response = await createApp(dependencies()).request("/missing");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: "NOT_FOUND", message: "Route not found" },
    });
  });
});
