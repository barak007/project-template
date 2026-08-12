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
    route.kind === "workspace-project" ||
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
  if (
    route.kind !== "workspace" &&
    route.kind !== "workspace-project" &&
    route.kind !== "session"
  )
    return undefined;
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

/**
 * Whether the signed-in user administers this organization — the only role the
 * server lets manage members and invitations. Read from the members list rather
 * than assumed, so a page offers what the API will actually allow: false until
 * that list has loaded, which is the safe way round.
 */
export function managesOrganization(state: AppState): boolean {
  if (state.auth.status !== "authenticated") return false;
  const { id } = state.auth.user;
  return state.members.some(
    (member) => member.userId === id && member.role === "owner",
  );
}

/**
 * Whether a collection has been read yet. A page that skips this shows "nothing
 * here yet" for as long as the first request takes, which is the wrong answer
 * for every account that has something.
 */
export function hasLoaded(state: AppState, key: string): boolean {
  return state.loaded.includes(key);
}

/** Whether the control with this key is waiting on the server. */
export function isPending(state: AppState, key: string): boolean {
  return state.pending.includes(key);
}

/** Whether this destructive control is armed and waiting for its second press. */
export function isConfirming(state: AppState, key: string): boolean {
  return state.confirming === key;
}
