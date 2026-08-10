import type { ClientState } from "../../domain-client/index.js";
import { createStore } from "../../domain-client/store.js";

import type { AppEvent } from "./events.js";
import { reduce } from "./projection.js";
import { initialAppOwnState } from "./state.js";
import type { AppState } from "./state.js";

/** The part of the client core this layer observes. */
type ObservableClient = {
  getState: () => ClientState;
  subscribe: (listener: () => void) => () => void;
};

export type AppStore = {
  getState: () => AppState;
  dispatch: (event: AppEvent) => void;
  subscribe: (listener: () => void) => () => void;
};

/**
 * The app's slices layered over the client core's, exposed as one store so
 * the UI has a single subscription and a single state tree. The snapshot is
 * rebuilt only when one of the two stores changes — `getState` must return a
 * stable value for React's useSyncExternalStore.
 */
export function createAppStore(client: ObservableClient): AppStore {
  const own = createStore(reduce, initialAppOwnState);
  const merge = (): AppState => ({ ...client.getState(), ...own.getState() });

  let snapshot = merge();
  const listeners = new Set<() => void>();
  const changed = () => {
    snapshot = merge();
    for (const listener of listeners) listener();
  };
  client.subscribe(changed);
  own.subscribe(changed);

  return {
    getState: () => snapshot,
    dispatch: own.dispatch,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
