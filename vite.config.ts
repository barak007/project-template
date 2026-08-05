import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: {
        server: "src/server.ts",
        worker: "src/worker.ts",
        migrate: "scripts/migrate.ts",
        seed: "scripts/seed.ts",
      },
      formats: ["es"],
    },
    rollupOptions: { external: [/^node:/, /^[^./]/] },
    target: "node22",
    minify: false,
  },
  server: { port: 3000 },
});
