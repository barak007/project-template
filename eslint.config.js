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
              target: "./client/src",
              from: "./src",
              except: ["./app.ts"],
              message:
                "The headless client may only import the AppType from src/app.ts.",
            },
            {
              target: "./client/src",
              from: ["./tests", "./client/tests"],
              message: "Client logic must not depend on test code.",
            },
            {
              target: "./src",
              from: "./client",
              message: "The server must not depend on the client.",
            },
            {
              target: "./src",
              from: "./backoffice",
              message: "The server must not depend on the backoffice.",
            },
            {
              target: "./client",
              from: "./backoffice",
              message: "The client must not depend on the backoffice.",
            },
            {
              target: "./backoffice",
              from: "./src",
              except: ["./app.ts"],
              message:
                "The backoffice may only import the AppType from src/app.ts.",
            },
            {
              target: "./backoffice",
              from: "./client/src",
              except: ["./index.ts", "./store.ts", "./errors.ts", "./host.ts"],
              message:
                "The backoffice composes the client core through its public entry (plus the generic store/errors/host modules).",
            },
            {
              target: "./backoffice/core",
              from: [
                "./tests",
                "./client/tests",
                "./backoffice/tests",
                "./backoffice/ui",
              ],
              message:
                "The backoffice core must not depend on test code or the UI.",
            },
          ],
        },
      ],
    },
  },
  {
    // The client core is headless and environment-agnostic: it must run in a
    // browser, in Node, or anywhere else — so no runtime globals of either.
    // Every environmental capability enters through the Host (client/src/host.ts),
    // which is why even global fetch is banned.
    files: ["client/src/**/*.ts", "backoffice/core/**/*.ts"],
    rules: {
      "import-x/no-nodejs-modules": "error",
      // The zone above limits server imports to src/app.ts; this closes the
      // remaining gap by allowing only TYPE imports across that boundary.
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/src/**"],
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
    // The backoffice core shares the headless rules above, but its allowed
    // runtime imports (client/src/store.ts, errors.ts) live under a src/
    // segment, so the type-only restriction narrows to the server's src.
    files: ["backoffice/core/**/*.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/src/**", "!**/client/src/**"],
              allowTypeImports: true,
              message:
                "Only type imports may cross into the server; runtime code stays out of the backoffice core.",
            },
          ],
        },
      ],
    },
  },
);
