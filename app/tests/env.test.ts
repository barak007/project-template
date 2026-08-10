import { describe, expect, it } from "vitest";

import { loadAppEnvironment } from "../server/env.js";

describe("app environment", () => {
  it("defaults the dev server port", () => {
    expect(loadAppEnvironment({}).APP_PORT).toBe(5174);
  });

  it("coerces a configured port", () => {
    expect(loadAppEnvironment({ APP_PORT: "4000" }).APP_PORT).toBe(4000);
  });

  it("names the offending field when the port is impossible", () => {
    expect(() => loadAppEnvironment({ APP_PORT: "70000" })).toThrowError(
      /APP_PORT/,
    );
  });
});
