import type {
  Organization,
  WorkSession,
  Workspace,
} from "../../domain-client/index.js";

import { requiresAuthentication } from "./router.js";
import type { Route } from "./router.js";
import type { AppState } from "./state.js";

/**
 * The page to render for the current route given who is signed in. The guard
 * is a pure projection rather than a redirect: the URL keeps pointing at the
 * page the visitor asked for, so signing in lands them there.
 */
export function visibleRoute(state: AppState): Route {
  const authenticated = state.auth.status === "authenticated";
  if (requiresAuthentication(state.route) && !authenticated)
    return { kind: "sign-in" };
  if (
    authenticated &&
    (state.route.kind === "sign-in" || state.route.kind === "sign-up")
  )
    return { kind: "dashboard" };
  return state.route;
}

/** The organization the route names, or none if the route names no organization. */
export function routeOrganizationId(state: AppState): string | undefined {
  const { route } = state;
  if (
    route.kind === "organization" ||
    route.kind === "workspace" ||
    route.kind === "session"
  )
    return route.organizationId;
  return undefined;
}

/** The organization the route names, once the list holding it has loaded. */
export function currentOrganization(state: AppState): Organization | undefined {
  const organizationId = routeOrganizationId(state);
  if (organizationId === undefined) return undefined;
  return state.organizations.find(
    (organization) => organization.id === organizationId,
  );
}

/** The workspace the route names, once the organization's list has loaded. */
export function currentWorkspace(state: AppState): Workspace | undefined {
  const { route } = state;
  if (route.kind !== "workspace" && route.kind !== "session") return undefined;
  return state.workspaces.find(
    (workspace) => workspace.id === route.workspaceId,
  );
}

/** The work session the route names, once the organization's list has loaded. */
export function currentWorkSession(state: AppState): WorkSession | undefined {
  if (state.route.kind !== "session") return undefined;
  const { workSessionId } = state.route;
  return state.workSessions.find((session) => session.id === workSessionId);
}
