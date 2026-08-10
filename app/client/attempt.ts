import { ApiError } from "../../domain-client/index.js";

import type { AppError } from "./state.js";
import type { AppStore } from "./store.js";

/** Runs one user-triggered action; failures land in state, never as throws. */
export type Attempt = (action: () => Promise<void>) => Promise<void>;

type SessionClient = { auth: { loadSession: () => Promise<void> } };

function toAppError(error: unknown): AppError {
  if (error instanceof ApiError)
    return { code: error.code, message: error.message };
  return {
    code: "UNEXPECTED",
    message: "Something went wrong. Please try again.",
  };
}

/**
 * The failure contract of this layer: the client core throws `ApiError` for
 * anything that is not an authentication failure, and a UI cannot handle a
 * throw — so every action goes through here and the error becomes a state
 * slice. An expired session is not an error message: it re-resolves the
 * session, which drops the user back to the sign-in page.
 */
export function createAttempt(client: SessionClient, store: AppStore): Attempt {
  return async (action) => {
    store.dispatch({ type: "action-started" });
    try {
      await action();
    } catch (error) {
      if (error instanceof ApiError && error.code === "AUTHENTICATION_REQUIRED")
        await client.auth.loadSession();
      else store.dispatch({ type: "action-failed", error: toAppError(error) });
    }
  };
}
