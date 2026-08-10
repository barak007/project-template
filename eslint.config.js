import eslint from "@eslint/js";
import importX from "eslint-plugin-import-x";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "backoffice/dist/**",
      "coverage/**",
      "drizzle/meta/**",
      "eslint.config.js",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: { "import-x/resolver": { typescript: true } },
    rules: {
      "import-x/order": [
        "error",
        { "newlines-between": "always", alphabetize: { order: "asc" } },
      ],
      "import-x/no-unresolved": "off",
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      // Underscore-prefixed values exist only to be reflected as types
      // (e.g. Hono's value-level client-type witness).
      "@typescript-eslint/no-unused-vars": [
        "error",
        { varsIgnorePattern: "^_", argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: false },
      ],
      "import-x/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "./domain-client/*.ts",
              from: "./domain-server",
              except: ["./app.ts"],
              message:
                "The headless client may only import the AppType from domain-server/app.ts.",
            },
            {
              target: "./domain-client/*.ts",
              from: ["./domain-server/tests", "./domain-client/tests"],
              message: "Client logic must not depend on test code.",
            },
            {
              target: "./domain-server",
              from: "./domain-client",
              message: "The server must not depend on the client.",
            },
            {
              // Composition roots (domain-server/server.ts, domain-server/dev-app.ts)
              // mount the backoffice server; nothing else may reach into it.
              target: "./domain-server",
              from: "./backoffice",
              except: ["./server"],
              message:
                "Only the composition entries may mount the backoffice server; the API must not depend on the backoffice.",
            },
            {
              // Same shape for the web app: the composition root wraps the API
              // in the app's static shell (app/server/web.ts) and nothing else
              // in the API knows the app exists.
              target: "./domain-server",
              from: "./app",
              except: ["./server"],
              message:
                "Only the composition entries may mount the web app; the API must not depend on the app.",
            },
            {
              target: "./domain-client",
              from: "./app",
              message: "The client must not depend on the app.",
            },
            {
              target: "./app",
              from: "./backoffice",
              message:
                "The app and the backoffice are separate front ends; neither may import the other.",
            },
            {
              target: "./backoffice",
              from: "./app",
              message:
                "The app and the backoffice are separate front ends; neither may import the other.",
            },
            {
              target: "./app",
              from: "./domain-client",
              except: [
                "./index.ts",
                "./store.ts",
                "./errors.ts",
                "./host.ts",
                "./history.ts",
                "./navigation.ts",
                // The app's story tests reuse the client test kit.
                "./tests",
              ],
              message:
                "The app composes the client core through its public entry (plus the generic store/errors/host/routing modules).",
            },
            {
              // Scoped to the browser-facing code: app/server and
              // app/vite.config.ts are Node-side and may import freely.
              target: ["./app/client", "./app/ui"],
              from: "./domain-server",
              message:
                "The app's client and UI must not import server code; API types come from the client core.",
            },
            {
              target: "./app/client",
              from: [
                "./app/server",
                "./app/ui",
                "./app/tests",
                "./domain-client/tests",
                "./domain-server/tests",
              ],
              message:
                "The app client is headless: no server code, no UI, no test code.",
            },
            {
              target: "./domain-client",
              from: "./backoffice",
              message: "The client must not depend on the backoffice.",
            },
            {
              // Scoped to the browser-facing code: backoffice/server and
              // backoffice/vite.config.ts are Node-side and may import the
              // server freely.
              target: ["./backoffice/client", "./backoffice/ui"],
              from: "./domain-server",
              message:
                "The backoffice client and UI must not import server code; API types come from backoffice/server.",
            },
            {
              // Backoffice tests exercise the real app + database.
              target: "./backoffice/tests",
              from: "./domain-server",
              except: [
                "./app.ts",
                "./db/client.ts",
                "./db/schema.ts",
                // The shared test harness lives with the domain server's tests.
                "./tests/helpers",
              ],
              message:
                "Backoffice tests may only use the app's database handles and the shared test harness; everything else comes through the API.",
            },
            {
              target: "./backoffice",
              from: "./domain-client",
              except: [
                "./index.ts",
                "./store.ts",
                "./errors.ts",
                "./host.ts",
                "./history.ts",
                "./navigation.ts",
                // The backoffice tests reuse the client test kit.
                "./tests",
              ],
              message:
                "The backoffice composes the client core through its public entry (plus the generic store/errors/host modules).",
            },
            {
              target: "./backoffice/client",
              from: [
                "./domain-server/tests",
                "./domain-client/tests",
                "./backoffice/tests",
                "./backoffice/ui",
              ],
              message:
                "The backoffice client must not depend on test code or the UI.",
            },
          ],
        },
      ],
    },
  },
  {
    // The client core is headless and environment-agnostic: it must run in a
    // browser, in Node, or anywhere else — so no runtime globals of either.
    // Every environmental capability enters through the Host (domain-client/host.ts),
    // which is why even global fetch is banned.
    files: [
      "domain-client/*.ts",
      "app/client/**/*.ts",
      "backoffice/client/**/*.ts",
    ],
    rules: {
      "import-x/no-nodejs-modules": "error",
      // The zone above limits server imports to domain-server/app.ts; this closes the
      // remaining gap by allowing only TYPE imports across that boundary.
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/domain-server/**"],
              allowTypeImports: true,
              message:
                "Only type imports may cross into the server; runtime code stays out of the client.",
            },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        "process",
        "Buffer",
        "global",
        "globalThis",
        "require",
        "__dirname",
        "window",
        "document",
        "navigator",
        "localStorage",
        "fetch",
        "XMLHttpRequest",
        "WebSocket",
        "setTimeout",
        "setInterval",
      ],
    },
  },
  {
    // The backoffice client shares the headless rules above, but additionally
    // its own server (backoffice/server) may only contribute types.
    files: ["backoffice/client/**/*.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/domain-server/**"],
              allowTypeImports: true,
              message:
                "Only type imports may cross into the server; runtime code stays out of the backoffice client.",
            },
            {
              group: ["../server/**", "**/backoffice/server/**"],
              allowTypeImports: true,
              message:
                "The backoffice client is headless; only types may come from the backoffice server.",
            },
          ],
        },
      ],
    },
  },
);
