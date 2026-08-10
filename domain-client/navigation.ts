import type { History } from "./history.js";

/** The route vocabulary of one routed client: values in, paths out. */
export type Router<Route> = {
  pathToRoute: (path: string) => Route;
  routeToPath: (route: Route) => string;
};

/**
 * Routing is headless: the store is the single source of truth for the
 * current route and the URL is a projection of it. `navigate` moves both
 * together, and environment-driven changes (browser back/forward) flow in
 * through history.onChange. Each client owns its Route type and dispatches
 * its own event through `onRoute`.
 */
export function createNavigation<Route>(
  history: History,
  router: Router<Route>,
  onRoute: (route: Route) => void,
) {
  history.onChange((path) => {
    onRoute(router.pathToRoute(path));
  });

  // Normalize the boot URL (e.g. "/" becomes the default route's path).
  const initial = router.pathToRoute(history.path());
  history.replace(router.routeToPath(initial));
  onRoute(initial);

  return {
    navigate: (route: Route) => {
      history.push(router.routeToPath(route));
      onRoute(route);
    },
    /** Rewrites the current entry — for URL state (e.g. pagination), not moves. */
    replace: (route: Route) => {
      history.replace(router.routeToPath(route));
      onRoute(route);
    },
  };
}
