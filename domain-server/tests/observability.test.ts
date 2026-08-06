import * as Sentry from "@sentry/node";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Environment } from "../config/env.js";
import { configureObservability } from "../observability.js";

vi.mock("@sentry/node", () => ({
  init: vi.fn(),
  captureException: vi.fn(),
}));

function environment(overrides: Partial<Environment> = {}): Environment {
  return {
    NODE_ENV: "production",
    SENTRY_DSN: "https://key@sentry.example.test/1",
    ...overrides,
  } as Environment;
}

describe("configureObservability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("initializes Sentry and forwards errors when a DSN is set", () => {
    const report = configureObservability(environment());
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({ sendDefaultPii: false, tracesSampleRate: 0.1 }),
    );
    report(new Error("boom"));
    expect(Sentry.captureException).toHaveBeenCalled();
  });

  it("disables tracing outside production", () => {
    configureObservability(environment({ NODE_ENV: "development" }));
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({ tracesSampleRate: 0 }),
    );
  });

  it("logs locally without Sentry when no DSN is set", () => {
    const report = configureObservability(environment({ SENTRY_DSN: "" }));
    report(new Error("boom"));
    expect(Sentry.init).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });
});
