import { toApiError } from "../../client/src/errors.js";

import type { Api } from "./api.js";
import type { BackofficeStore } from "./projection.js";

type Credentials = { email: string; password: string };

export function createBackofficeAuthActions(api: Api, store: BackofficeStore) {
  const routes = api.auth;

  /** Setup and sign-in failures become state, never thrown. */
  async function establishSession(
    response: Response,
    email: string,
  ): Promise<void> {
    if (!response.ok) {
      const error = await toApiError(response);
      store.dispatch({
        type: "auth-failed",
        error: { code: error.code, message: error.message },
      });
      return;
    }
    store.dispatch({ type: "signed-in", email });
  }

  return {
    loadStatus: async () => {
      const response = await routes.status.$get();
      if (!response.ok) throw await toApiError(response);
      const status = await response.json();
      store.dispatch({
        type: "auth-status-loaded",
        configured: status.configured,
        authenticated: status.authenticated,
        ...(status.email === undefined ? {} : { email: status.email }),
      });
    },
    setup: async (credentials: Credentials) =>
      establishSession(
        await routes.setup.$post({ json: credentials }),
        credentials.email,
      ),
    signIn: async (credentials: Credentials) =>
      establishSession(
        await routes["sign-in"].$post({ json: credentials }),
        credentials.email,
      ),
    signOut: async () => {
      await routes["sign-out"].$post();
      store.dispatch({ type: "signed-out" });
    },
  };
}
