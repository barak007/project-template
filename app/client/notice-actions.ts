import type { AppActionContext } from "./context.js";

/**
 * The error banner, as the user can act on it. An error clears itself when the
 * next action starts, but a user who has read it should be able to put it away
 * without doing something else first.
 */
export function createNoticeActions({ store }: AppActionContext) {
  return {
    dismiss: () => {
      store.dispatch({ type: "error-dismissed" });
    },
  };
}
