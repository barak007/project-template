import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";

/** Where `vite build --config app/vite.config.ts` puts the built app. */
export const appDistDirectory = "dist/app";

/** The API as this wrapper needs it: something that answers a Request. */
type FetchHandler = {
  fetch: (request: Request) => Response | Promise<Response>;
};

/** Paths the API owns; a 404 from them stays a 404 with the JSON envelope. */
function belongsToApi(path: string): boolean {
  return /^\/(api|backoffice|assets|health|ready)(\/|$)/.test(path);
}

/**
 * Serves the built single-page app from the same origin as the API, so the
 * session cookie is first-party and no CORS is involved. The API answers
 * first; only a 404 on a path the API does not own falls through to the app
 * shell, because the route (e.g. /app/organizations/x) is the client
 * router's to resolve. In development this wrapper is unused — Vite serves
 * the app and proxies the API (app/vite.config.ts).
 */
export function createWebApp(api: FetchHandler, distDir = appDistDirectory) {
  let shell: Promise<string> | undefined;
  const readShell = () =>
    (shell ??= readFile(join(distDir, "index.html"), "utf8"));

  return (
    new Hono()
      // Hashed build output: safe to serve straight from disk.
      .use("/assets/*", serveStatic({ root: distDir }))
      .all("*", async (context) => {
        const response = await api.fetch(context.req.raw);
        if (response.status !== 404 || belongsToApi(context.req.path))
          return response;
        try {
          return context.html(await readShell());
        } catch {
          shell = undefined;
          return context.text(
            "The web app has not been built. Run `pnpm build`.",
            500,
          );
        }
      })
  );
}
