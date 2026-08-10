import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { loadEnvironment } from "../domain-server/config/env.js";

import { loadAppEnvironment } from "./server/env.js";
import { appDistDirectory } from "./server/web.js";

export default defineConfig(({ command }) => ({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react()],
  // The API process serves this output in production (app/server/web.ts), so
  // the directory is named there, once.
  build: {
    outDir: fileURLToPath(new URL(`../${appDistDirectory}`, import.meta.url)),
    emptyOutDir: true,
  },
  // Ports come from the environment schema — the one place defaults live.
  // Resolved only for `serve`: builds must not require a configured .env.
  ...(command === "serve" ? { server: devServer() } : {}),
}));

function devServer() {
  const apiOrigin = `http://localhost:${String(loadEnvironment().PORT)}`;
  return {
    port: loadAppEnvironment().APP_PORT,
    proxy: { "/api": apiOrigin },
  };
}
