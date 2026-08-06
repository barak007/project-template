import type { History } from "./history.js";
import type { BackofficeStore } from "./projection.js";
import { pathToRoute, routeToPath } from "./router.js";
import type { Route } from "./router.js";

/**
 * The store is the single source of truth for the current route; the URL is
 * a projection of it. `navigate` moves both together, and environment-driven
 * changes (browser back/forward) flow in through history.onChange.
 */
export function createNavigation(history: History, store: BackofficeStore) {
  history.onChange((path) => {
    store.dispatch({ type: "navigated", route: pathToRoute(path) });
  });

  // Normalize the boot URL (e.g. "/" becomes the default route's path).
  const initial = pathToRoute(history.path());
  history.replace(routeToPath(initial));
  store.dispatch({ type: "navigated", route: initial });

  return {
    navigate: (route: Route) => {
      history.push(routeToPath(route));
      store.dispatch({ type: "navigated", route });
    },
  };
}
