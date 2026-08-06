import { useSyncExternalStore } from "react";

import type { BackofficeCore, BackofficeState } from "../core/index.js";

export function useBackofficeState<T>(
  core: BackofficeCore,
  select: (state: BackofficeState) => T,
): T {
  return useSyncExternalStore(core.subscribe, () => select(core.getState()));
}
