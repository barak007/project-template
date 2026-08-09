import { createClientCore } from "../../index.js";
import type { ClientFetch } from "../../index.js";

import { browserFetch } from "./browser-fetch.js";
import { clientWorldMode, sharedBaseUrlVariable } from "./mode.js";
import { createWorldApp } from "./world-app.js";

type Connection = {
  baseUrl: string;
  request: ClientFetch;
  close: () => Promise<void>;
};

function connectSharedServer(): Connection {
  const baseUrl = process.env[sharedBaseUrlVariable];
  if (!baseUrl)
    throw new Error(
      "The shared client-world server is not running — global-setup did not boot it",
    );
  return {
    baseUrl,
    request: (input, init) => fetch(input, init),
    close: () => Promise.resolve(),
  };
}

async function connectInProcess(): Promise<Connection> {
  const baseUrl = "http://client.test";
  const { app, close } = await createWorldApp(baseUrl);
  return {
    baseUrl,
    request: async (input, init) => app.request(input, init),
    close,
  };
}

/**
 * A per-test handle on the backend universe (see mode.ts for how it runs).
 * The universe may be shared, so tests never use fixed identifiers — emails
 * always come salted. Each `newClient()` is an independent "browser" (its own
 * client core and cookie jar).
 */
export async function createWorld() {
  const { baseUrl, request, close } =
    clientWorldMode() === "http"
      ? connectSharedServer()
      : await connectInProcess();
  let personas = 0;

  const newClient = () =>
    createClientCore({ baseUrl, host: { fetch: browserFetch(request) } });
  const uniqueEmail = (name: string) =>
    `${name}-${crypto.randomUUID().slice(0, 8)}@example.test`;

  /** Persona shortcut: a client already signed up and signed in. */
  const signedUpUser = async (name = `user-${(personas += 1)}`) => {
    const core = newClient();
    const credentials = {
      email: uniqueEmail(name),
      password: `password-for-${name}`,
    };
    await core.auth.signUp({ ...credentials, name });
    if (core.getState().auth.status !== "authenticated")
      throw new Error(`Sign-up failed for persona ${name}`);
    return { core, credentials };
  };

  /** Persona shortcut: a signed-in user who owns a fresh organization. */
  const founder = async (name = `founder-${(personas += 1)}`) => {
    const persona = await signedUpUser(name);
    await persona.core.organizations.create({ name: `${name}'s organization` });
    const organization = persona.core.getState().organizations[0];
    if (!organization)
      throw new Error(`Organization creation failed for ${name}`);
    return { ...persona, organization };
  };

  return {
    baseUrl,
    request,
    newClient,
    uniqueEmail,
    signedUpUser,
    founder,
    close,
  };
}

export type World = Awaited<ReturnType<typeof createWorld>>;
