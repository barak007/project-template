import { toApiError } from "./errors.js";
import type { Host } from "./host.js";
import type { ClientStore } from "./projection.js";
import type { AuthError, AuthUser } from "./state.js";

type Credentials = { email: string; password: string };

/** Better Auth reports failures as a flat `{ code, message }` body. */
async function readAuthError(response: {
  status: number;
  json: () => Promise<unknown>;
}): Promise<AuthError> {
  const body = (await response.json().catch(() => null)) as {
    code?: string;
    message?: string;
  } | null;
  return {
    code: body?.code ?? "AUTHENTICATION_FAILED",
    message:
      body?.message ?? `Authentication failed with status ${response.status}`,
  };
}

export function createAuthActions(
  baseUrl: string,
  host: Host,
  store: ClientStore,
) {
  async function establishSession(path: string, body: Record<string, string>) {
    const response = await host.fetch(`${baseUrl}/api/auth/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      store.dispatch({
        type: "sign-in-failed",
        error: await readAuthError(response),
      });
      return;
    }
    const { user } = (await response.json()) as { user: AuthUser };
    store.dispatch({
      type: "signed-in",
      user: { id: user.id, name: user.name, email: user.email },
    });
  }

  return {
    /**
     * Resolves whether this device already holds a session — the cookie
     * outlives the core, so a freshly constructed client (a page reload)
     * starts anonymous until this says otherwise.
     */
    loadSession: async () => {
      const response = await host.fetch(`${baseUrl}/api/auth/get-session`);
      const body = response.ok
        ? ((await response.json().catch(() => null)) as {
            user?: AuthUser;
          } | null)
        : null;
      if (!body?.user) {
        store.dispatch({ type: "signed-out" });
        return;
      }
      const { id, name, email } = body.user;
      store.dispatch({ type: "signed-in", user: { id, name, email } });
    },
    signUp: (input: Credentials & { name: string }) =>
      establishSession("sign-up/email", input),
    signIn: (input: Credentials) => establishSession("sign-in/email", input),
    signOut: async () => {
      // Better Auth rejects the call without a JSON content type and body
      // (415, then 400), which would leave the session alive on the server
      // while this device believed it had left.
      const response = await host.fetch(`${baseUrl}/api/auth/sign-out`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      if (!response.ok) throw await toApiError(response);
      store.dispatch({ type: "signed-out" });
    },
  };
}
