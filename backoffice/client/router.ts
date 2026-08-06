/**
 * Routing is headless: routes are plain values, and the mapping to and from
 * URL paths lives here so the UI never parses locations itself.
 */
export type Route =
  | { kind: "users" }
  | { kind: "organizations" }
  | { kind: "organization"; organizationId: string }
  | { kind: "table"; table: string };

export const defaultRoute: Route = { kind: "users" };

export function routeToPath(route: Route): string {
  switch (route.kind) {
    case "users":
      return "/users";
    case "organizations":
      return "/organizations";
    case "organization":
      return `/organizations/${encodeURIComponent(route.organizationId)}`;
    case "table":
      return `/tables/${encodeURIComponent(route.table)}`;
  }
}

/** Unknown paths land on the default route rather than a dead end. */
export function pathToRoute(path: string): Route {
  const [first, second] = path
    .split("/")
    .filter(Boolean)
    .map(decodeURIComponent);
  if (first === "organizations" && second !== undefined)
    return { kind: "organization", organizationId: second };
  if (first === "organizations") return { kind: "organizations" };
  if (first === "tables" && second !== undefined)
    return { kind: "table", table: second };
  return defaultRoute;
}
