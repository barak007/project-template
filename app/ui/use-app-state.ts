import { useSyncExternalStore } from "react";

import type { AppCore, AppState } from "../client/index.js";

/**
 * The whole React binding: components read slices of the store and call
 * actions. A selector must return a stable value — select a slice or a
 * primitive, never a freshly built object.
 */
export function useAppState<T>(
  core: AppCore,
  select: (state: AppState) => T,
): T {
  return useSyncExternalStore(core.subscribe, () => select(core.getState()));
}
