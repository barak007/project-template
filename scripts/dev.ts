import { createServer as createNodeServer } from "node:http";
import { fileURLToPath } from "node:url";

import { getRequestListener } from "@hono/node-server";
import { createServer as createViteServer } from "vite";

type DevApp = typeof import("../src/dev-app.js");

// The dev entry composes the app with the backoffice server, so edits to
// either must swap the module graph.
const watchedDirs = [
  fileURLToPath(new URL("../src/", import.meta.url)),
  fileURLToPath(new URL("../backoffice/server/", import.meta.url)),
];

// Middleware-mode Vite server used purely as a hot module loader for the API:
// src/ edits invalidate the module graph in-process instead of restarting.
const loader = await createViteServer({
  root: fileURLToPath(new URL("..", import.meta.url)),
  configFile: false,
  clearScreen: false,
  appType: "custom",
  server: { middlewareMode: true },
});

let current: Promise<DevApp> | undefined;

function loadApp(): Promise<DevApp> {
  if (!current) {
    const next = loader.ssrLoadModule("/src/dev-app.ts") as Promise<DevApp>;
    current = next;
    // A failed load (syntax/config error) must not stick; retry on next request.
    next.catch(() => {
      if (current === next) current = undefined;
    });
  }
  return current;
}

function invalidate(file: string) {
  if (!watchedDirs.some((dir) => file.startsWith(dir))) return;
  const previous = current;
  current = undefined;
  void previous?.then((module) => module.dispose()).catch(() => undefined);
}

loader.watcher.on("change", invalidate);
loader.watcher.on("add", invalidate);
loader.watcher.on("unlink", invalidate);

const { port } = await loadApp();

const api = createNodeServer(
  getRequestListener(async (request) => {
    try {
      const { app } = await loadApp();
      return await app.fetch(request);
    } catch (error) {
      console.error(error);
      return new Response(
        "Dev API failed to load; check the terminal for the error.",
        { status: 500 },
      );
    }
  }),
);
api.listen(port, () => {
  console.info(`API listening on http://localhost:${String(port)}`);
});

const backoffice = await createViteServer({
  configFile: fileURLToPath(
    new URL("../backoffice/vite.config.ts", import.meta.url),
  ),
});
await backoffice.listen();
backoffice.printUrls();

let shuttingDown = false;
async function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`Received ${signal}; shutting down`);
  const running = current;
  current = undefined;
  await Promise.allSettled([
    backoffice.close(),
    loader.close(),
    new Promise<void>((resolve) => api.close(() => resolve())),
    running?.then((module) => module.dispose()),
  ]);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
