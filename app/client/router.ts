/**
 * Routing is headless: routes are plain values, and the mapping to and from
 * URL paths lives here so the UI never parses locations itself. The public
 * site is at the root; everything behind the login sits under /app.
 */
export type Route =
  | { kind: "home" }
  | { kind: "sign-in" }
  | { kind: "sign-up" }
  | { kind: "dashboard" }
  | { kind: "organization"; organizationId: string }
  | { kind: "workspace"; organizationId: string; workspaceId: string }
  /** The workspace's own git project — the template every session clones. */
  | { kind: "workspace-project"; organizationId: string; workspaceId: string }
  | {
      kind: "session";
      organizationId: string;
      workspaceId: string;
      workSessionId: string;
    };

export const defaultRoute: Route = { kind: "home" };

/** Routes that only exist for a signed-in user; see selectors.visibleRoute. */
export function requiresAuthentication(route: Route): boolean {
  return (
    route.kind === "dashboard" ||
    route.kind === "organization" ||
    route.kind === "workspace" ||
    route.kind === "workspace-project" ||
    route.kind === "session"
  );
}

export function routeToPath(route: Route): string {
  switch (route.kind) {
    case "home":
      return "/";
    case "sign-in":
      return "/sign-in";
    case "sign-up":
      return "/sign-up";
    case "dashboard":
      return "/app";
    case "organization":
      return `/app/organizations/${encodeURIComponent(route.organizationId)}`;
    case "workspace":
      return workspacePath(route);
    case "workspace-project":
      return `${workspacePath(route)}/project`;
    case "session":
      return `${workspacePath(route)}/sessions/${encodeURIComponent(
        route.workSessionId,
      )}`;
  }
}

function workspacePath(route: {
  organizationId: string;
  workspaceId: string;
}): string {
  return `/app/organizations/${encodeURIComponent(
    route.organizationId,
  )}/workspaces/${encodeURIComponent(route.workspaceId)}`;
}

/** Unknown paths land on the home page rather than a dead end. */
export function pathToRoute(path: string): Route {
  const [pathname = ""] = path.split("?");
  const [first, second, third, fourth, fifth, sixth, seventh] = pathname
    .split("/")
    .filter(Boolean)
    .map(decodeURIComponent);
  if (first === undefined) return { kind: "home" };
  if (first === "sign-in") return { kind: "sign-in" };
  if (first === "sign-up") return { kind: "sign-up" };
  if (first === "app") {
    if (second === "organizations" && third !== undefined) {
      if (fourth === "workspaces" && fifth !== undefined) {
        if (sixth === "project")
          return {
            kind: "workspace-project",
            organizationId: third,
            workspaceId: fifth,
          };
        if (sixth === "sessions" && seventh !== undefined)
          return {
            kind: "session",
            organizationId: third,
            workspaceId: fifth,
            workSessionId: seventh,
          };
        return { kind: "workspace", organizationId: third, workspaceId: fifth };
      }
      return { kind: "organization", organizationId: third };
    }
    return { kind: "dashboard" };
  }
  return defaultRoute;
}
