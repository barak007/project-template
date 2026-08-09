import type { AddressInfo } from "node:net";

import { serve } from "@hono/node-server";
import type { ServerType } from "@hono/node-server";

import { clientWorldMode, sharedBaseUrlVariable } from "./mode.js";
import type { WorldApp } from "./world-app.js";
import { createWorldApp } from "./world-app.js";

function listeningPort(server: ServerType): Promise<number> {
  return new Promise((resolve) => {
    const read = () => resolve((server.address() as AddressInfo).port);
    if (server.listening) read();
    else server.once("listening", read);
  });
}

/**
 * Boots the one real HTTP server all client stories share. Better Auth needs
 * its final base URL at creation and the port is only known once the listener
 * is up, so the socket binds first and the app arrives behind a late-bound
 * reference — no request can come in before the base URL is handed out anyway.
 */
export default async function setupSharedServer() {
  if (clientWorldMode() === "in-process") return;

  const world: { current?: WorldApp } = {};
  const server = serve({
    fetch: (request: Request) => {
      if (!world.current)
        throw new Error("Shared client world is still booting");
      return world.current.app.fetch(request);
    },
    port: 0,
  });
  const baseUrl = `http://127.0.0.1:${await listeningPort(server)}`;
  world.current = await createWorldApp(baseUrl);
  process.env[sharedBaseUrlVariable] = baseUrl;

  return async () => {
    if ("closeAllConnections" in server) server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await world.current?.close();
  };
}
