import type { History } from "../../domain-client/history.js";
import { createNavigation } from "../../domain-client/navigation.js";

import { pathToRoute, routeToPath } from "./router.js";
import type { AppStore } from "./store.js";

/** The shared routing loop bound to the app's routes and store. */
export function createAppNavigation(history: History, store: AppStore) {
  return createNavigation(history, { pathToRoute, routeToPath }, (route) => {
    store.dispatch({ type: "navigated", route });
  });
}

export type AppNavigation = ReturnType<typeof createAppNavigation>;
