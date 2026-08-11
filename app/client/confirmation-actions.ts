import type { AppActionContext } from "./context.js";

/**
 * Arming a destructive control. Deleting is two presses on the same row rather
 * than a modal: the confirmation is where the thing is, so what is about to go
 * is never in doubt, and no dialog has to be dismissed to change your mind.
 *
 * One key at a time — see `confirming` in state.ts. Anything else the user does
 * (navigating, opening a form, starting an action) disarms it, so a page never
 * carries a loaded delete button between tasks.
 */
export function createConfirmationActions({ store }: AppActionContext) {
  return {
    ask: (key: string) => {
      store.dispatch({ type: "confirmation-asked", key });
    },
    cancel: () => {
      store.dispatch({ type: "confirmation-cancelled" });
    },
  };
}
