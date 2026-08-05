import type { ClientFetch } from "./api.js";
import { initialState } from "./state.js";
import type { AuthError, AuthUser, ClientState } from "./state.js";
import type { Store } from "./store.js";

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
  fetch: ClientFetch,
  store: Store<ClientState>,
) {
  async function establishSession(path: string, body: Record<string, string>) {
    const response = await fetch(`${baseUrl}/api/auth/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const error = await readAuthError(response);
      store.setState((state) => ({
        ...state,
        auth: { status: "anonymous", error },
      }));
      return;
    }
    const { user } = (await response.json()) as { user: AuthUser };
    store.setState((state) => ({
      ...state,
      auth: {
        status: "authenticated",
        user: { id: user.id, name: user.name, email: user.email },
      },
    }));
  }

  return {
    signUp: (input: Credentials & { name: string }) =>
      establishSession("sign-up/email", input),
    signIn: (input: Credentials) => establishSession("sign-in/email", input),
    signOut: async () => {
      await fetch(`${baseUrl}/api/auth/sign-out`, { method: "POST" });
      // Signing out ends the identity, so every identity-scoped slice goes too.
      store.setState(() => initialState);
    },
  };
}
