import { ApiError } from "../../domain-client/index.js";

import type { AppError } from "./state.js";
import type { AppStore } from "./store.js";

/**
 * What an action reports about itself beyond succeeding or failing.
 *
 * `key` is what the pressed control is called, so a button can say it is
 * working and refuse a second press. `loaded` is the collection a read fills,
 * so a page can tell "empty" from "not asked yet". `background` marks work the
 * user did not ask for — a poll — which must not clear the error they are
 * reading or make a button look busy.
 */
export type AttemptOptions = {
  key?: string;
  loaded?: string;
  background?: boolean;
};

/** Runs one user-triggered action; failures land in state, never as throws. */
export type Attempt = (
  action: () => Promise<void>,
  options?: AttemptOptions,
) => Promise<void>;

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
 *
 * Every action also passes through here on the way out, which is what makes one
 * place enough to know what is in flight and what has been read.
 */
export function createAttempt(client: SessionClient, store: AppStore): Attempt {
  return async (action, options = {}) => {
    const { key, loaded, background = false } = options;
    // A poll announcing itself would wipe the error banner the user is reading
    // every time it ticks, and flash every button it touches.
    if (!background)
      store.dispatch({ type: "action-started", ...(key && { key }) });
    try {
      await action();
      if (!background)
        store.dispatch({
          type: "action-finished",
          ...(key && { key }),
          ...(loaded && { loaded }),
        });
    } catch (error) {
      if (error instanceof ApiError && error.code === "AUTHENTICATION_REQUIRED")
        await client.auth.loadSession();
      else
        store.dispatch({
          type: "action-failed",
          error: toAppError(error),
          ...(key && { key }),
          ...(loaded && { loaded }),
        });
    }
  };
}
