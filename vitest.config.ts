import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      // text for the CI log, html for local browsing, lcov/json-summary for tooling.
      reporter: ["text", "html", "lcov", "json-summary"],
      reportsDirectory: "coverage",
      include: ["src/**/*.ts"],
      exclude: [
        // Process entrypoints: wiring only, exercised by the smoke test.
        "src/server.ts",
        "src/worker.ts",
        // Generated migration artifacts / type-only modules.
        "src/**/*.d.ts",
      ],
      // Ratchet floors: raise these as tests land, never lower them.
      thresholds: {
        statements: 25,
        branches: 17,
        functions: 22,
        lines: 27,
      },
    },
  },
});
