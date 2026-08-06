import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: {
        server: "domain-server/server.ts",
        worker: "domain-server/worker.ts",
        migrate: "scripts/migrate.ts",
        seed: "scripts/seed.ts",
      },
      formats: ["es"],
    },
    rollupOptions: { external: [/^node:/, /^[^./]/] },
    target: "node24",
    minify: false,
  },
  server: { port: 3000 },
});
