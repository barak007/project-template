import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: ["./domain-client/tests/kit/global-setup.ts"],
    // CLIENT_WORLD=in-process boots one PGlite world per client story, and
    // many boot concurrently; the default 5s timeout is too tight for that.
    testTimeout: 30_000,
    coverage: {
      provider: "v8",
      // text for the CI log, html for local browsing, lcov/json-summary for tooling.
      reporter: ["text", "html", "lcov", "json-summary"],
      reportsDirectory: "coverage",
      include: [
        "domain-server/**/*.ts",
        "domain-client/*.ts",
        "app/client/**/*.ts",
        "app/server/**/*.ts",
        "backoffice/client/**/*.ts",
        "backoffice/server/**/*.ts",
      ],
      exclude: [
        "domain-server/tests/**",
        // Process entrypoints and runtime wiring: construct real
        // connections only; exercised by the smoke test.
        "domain-server/server.ts",
        "domain-server/worker.ts",
        "domain-server/runtime.ts",
        "domain-server/dev-app.ts",
        "backoffice/server/runtime.ts",
        // Generated migration artifacts / type-only modules.
        "domain-server/**/*.d.ts",
      ],
      // Ratchet floors: raise these as tests land, never lower them.
      thresholds: {
        statements: 93,
        branches: 86,
        functions: 88,
        lines: 94,
      },
    },
  },
});
