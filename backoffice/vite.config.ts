import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { loadEnvironment } from "../domain-server/config/env.js";

import { loadBackofficeEnvironment } from "./server/env.js";

export default defineConfig(({ command }) => ({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react()],
  build: { outDir: "dist", emptyOutDir: true },
  // Ports come from the environment schema — the one place defaults live.
  // Resolved only for `serve`: builds must not require a configured .env.
  ...(command === "serve" ? { server: devServer() } : {}),
}));

function devServer() {
  const apiOrigin = `http://localhost:${String(loadEnvironment().PORT)}`;
  return {
    port: loadBackofficeEnvironment().BACKOFFICE_PORT,
    proxy: { "/api": apiOrigin, "/backoffice": apiOrigin },
  };
}
