import eslint from "@eslint/js";
import importX from "eslint-plugin-import-x";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "coverage/**", "drizzle/meta/**", "eslint.config.js"],
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
          ],
        },
      ],
    },
  },
  {
    // The client core is headless and environment-agnostic: it must run in a
    // browser, in Node, or anywhere else — so no runtime globals of either.
    files: ["client/src/**/*.ts"],
    rules: {
      "import-x/no-nodejs-modules": "error",
      "no-restricted-globals": [
        "error",
        "process",
        "Buffer",
        "global",
        "require",
        "__dirname",
        "window",
        "document",
        "navigator",
        "localStorage",
      ],
    },
  },
);
