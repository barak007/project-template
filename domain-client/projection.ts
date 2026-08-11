import type { ClientEvent } from "./events.js";
import {
  emptyOrganizationSlices,
  emptySessionFiles,
  initialState,
} from "./state.js";
import type { ClientState, SessionFilesState } from "./state.js";
import type { Store } from "./store.js";

/** The store every action module dispatches into. */
export type ClientStore = Store<ClientState, ClientEvent>;

function replaceById<T extends { id: string }>(items: T[], item: T): T[] {
  return items.map((existing) => (existing.id === item.id ? item : existing));
}

function upsertById<T extends { id: string }>(items: T[], item: T): T[] {
  return items.some((existing) => existing.id === item.id)
    ? replaceById(items, item)
    : [...items, item];
}

function upsertByKey<T extends { key: string }>(items: T[], item: T): T[] {
  return [...removeByKey(items, item.key), item];
}

function removeById<T extends { id: string }>(items: T[], id: string): T[] {
  return items.filter((existing) => existing.id !== id);
}

function removeByKey<T extends { key: string }>(items: T[], key: string): T[] {
  return items.filter((existing) => existing.key !== key);
}

/**
 * The browsed tree of the session an event is about. State holds one session's
 * files at a time, so a fact about another session starts from nothing rather
 * than mixing two projects into one tree.
 */
function forSession(
  state: ClientState,
  workSessionId: string,
): SessionFilesState {
  return state.sessionFiles.workSessionId === workSessionId
    ? state.sessionFiles
    : { ...emptySessionFiles, workSessionId };
}

/** State shows one organization at a time; another organization's event resets the scoped slices. */
function scoped(state: ClientState, organizationId: string): ClientState {
  return state.currentOrganizationId === organizationId
    ? state
    : {
        ...state,
        ...emptyOrganizationSlices,
        currentOrganizationId: organizationId,
      };
}

/** The one place client state changes: a pure fold of events into state. */
export function reduce(previous: ClientState, event: ClientEvent): ClientState {
  const state =
    "organizationId" in event
      ? scoped(previous, event.organizationId)
      : previous;

  switch (event.type) {
    case "signed-in":
      return {
        ...state,
        auth: { status: "authenticated", user: event.user },
      };
    case "sign-in-failed":
      return { ...state, auth: { status: "anonymous", error: event.error } };
    case "signed-out":
      // Signing out ends the identity, so every identity-scoped slice goes too.
      return initialState;
    case "organizations-loaded":
      return { ...state, organizations: event.organizations };
    case "organization-created":
      return {
        ...state,
        organizations: [...state.organizations, event.organization],
      };
    case "members-loaded":
      return { ...state, members: event.members };
    case "membership-put":
      return {
        ...state,
        members: [
          ...state.members.filter(
            (existing) => existing.userId !== event.membership.userId,
          ),
          event.membership,
        ],
      };
    case "repository-added":
      return { ...state, sources: upsertById(state.sources, event.source) };
    case "sources-loaded":
      return { ...state, sources: event.sources };
    case "source-created":
      return { ...state, sources: [...state.sources, event.source] };
    case "source-updated":
      return { ...state, sources: replaceById(state.sources, event.source) };
    case "source-deleted":
      return { ...state, sources: removeById(state.sources, event.sourceId) };
    case "workspaces-loaded":
      return { ...state, workspaces: event.workspaces };
    case "workspace-created":
      return { ...state, workspaces: [...state.workspaces, event.workspace] };
    case "workspace-updated":
      return {
        ...state,
        workspaces: replaceById(state.workspaces, event.workspace),
      };
    case "workspace-deleted":
      return {
        ...state,
        workspaces: removeById(state.workspaces, event.workspaceId),
      };
    case "work-sessions-loaded":
      return { ...state, workSessions: event.workSessions };
    case "work-session-started":
      return {
        ...state,
        workSessions: [...state.workSessions, event.workSession],
      };
    case "work-session-refreshed":
      return {
        ...state,
        workSessions: upsertById(state.workSessions, event.workSession),
      };
    case "session-directory-loaded": {
      const files = forSession(state, event.workSessionId);
      return {
        ...state,
        sessionFiles: {
          ...files,
          directories: { ...files.directories, [event.path]: event.entries },
        },
      };
    }
    case "session-directory-collapsed": {
      const prefix = `${event.path}/`;
      return {
        ...state,
        sessionFiles: {
          ...state.sessionFiles,
          // Everything below it closes with it, so re-opening reads fresh.
          directories: Object.fromEntries(
            Object.entries(state.sessionFiles.directories).filter(
              ([path]) => path !== event.path && !path.startsWith(prefix),
            ),
          ),
        },
      };
    }
    case "session-file-loaded": {
      const files = forSession(state, event.workSessionId);
      return { ...state, sessionFiles: { ...files, openFile: event.file } };
    }
    case "organization-secrets-loaded":
      return { ...state, organizationSecrets: event.secrets };
    case "organization-secret-put":
      return {
        ...state,
        organizationSecrets: upsertByKey(
          state.organizationSecrets,
          event.secret,
        ),
      };
    case "organization-secret-deleted":
      return {
        ...state,
        organizationSecrets: removeByKey(state.organizationSecrets, event.key),
      };
    case "organization-data-loaded":
      return { ...state, organizationData: event.data };
    case "organization-data-put":
      return {
        ...state,
        organizationData: upsertByKey(state.organizationData, event.entry),
      };
    case "user-secrets-loaded":
      return { ...state, userSecrets: event.secrets };
    case "user-secret-put":
      return {
        ...state,
        userSecrets: upsertByKey(state.userSecrets, event.secret),
      };
    case "user-secret-deleted":
      return {
        ...state,
        userSecrets: removeByKey(state.userSecrets, event.key),
      };
    case "user-data-loaded":
      return { ...state, userData: event.data };
    case "user-data-put":
      return { ...state, userData: upsertByKey(state.userData, event.entry) };
  }
}
