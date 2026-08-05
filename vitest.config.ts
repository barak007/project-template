import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: ["./client/tests/kit/global-setup.ts"],
    coverage: {
      provider: "v8",
      // text for the CI log, html for local browsing, lcov/json-summary for tooling.
      reporter: ["text", "html", "lcov", "json-summary"],
      reportsDirectory: "coverage",
      include: ["src/**/*.ts", "client/src/**/*.ts"],
      exclude: [
        // Process entrypoints and runtime wiring: construct real
        // connections only; exercised by the smoke test.
        "src/server.ts",
        "src/worker.ts",
        "src/runtime.ts",
        // Generated migration artifacts / type-only modules.
        "src/**/*.d.ts",
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
