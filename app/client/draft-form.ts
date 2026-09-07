import type { AppEvent } from "./events.js";
import type { CreateForm } from "./state.js";
import type { AppStore } from "./store.js";

/**
 * The lifecycle every create form shares: type into a draft, open the form,
 * cancel it (which also empties the draft), and empty-then-close after a
 * successful create. Each action module composes this around its own draft
 * event — the shape of the draft and the event carrying it stay the module's.
 */
export function createDraftForm<Change>(
  store: AppStore,
  options: {
    form: CreateForm;
    changed: (change: Change) => AppEvent;
    empty: NoInfer<Change>;
  },
) {
  const reset = () => {
    store.dispatch(options.changed(options.empty));
  };
  return {
    change: (change: Change) => {
      store.dispatch(options.changed(change));
    },
    open: () => {
      store.dispatch({ type: "create-form-opened", form: options.form });
    },
    cancel: () => {
      store.dispatch({ type: "create-form-closed" });
      reset();
    },
    /** After a successful create: the draft empties and the form closes. */
    finish: () => {
      reset();
      store.dispatch({ type: "create-form-closed" });
    },
  };
}
