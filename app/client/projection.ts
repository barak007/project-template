import type { AppEvent } from "./events.js";
import type { AppOwnState } from "./state.js";

/** The one place the app's own slices change: a pure fold of events. */
export function reduce(state: AppOwnState, event: AppEvent): AppOwnState {
  switch (event.type) {
    case "navigated":
      // Moving to another page abandons whatever the last one failed at.
      return { ...state, route: event.route, error: null };
    case "session-resolved":
      return { ...state, sessionResolved: true };
    case "sign-in-draft-changed":
      return {
        ...state,
        signInDraft: { ...state.signInDraft, ...event.draft },
      };
    case "sign-up-draft-changed":
      return {
        ...state,
        signUpDraft: { ...state.signUpDraft, ...event.draft },
      };
    case "organization-draft-changed":
      return {
        ...state,
        organizationDraft: { ...state.organizationDraft, ...event.draft },
      };
    case "workspace-draft-changed":
      return {
        ...state,
        workspaceDraft: { ...state.workspaceDraft, ...event.draft },
      };
    case "connection-draft-changed":
      return {
        ...state,
        connectionDraft: { ...state.connectionDraft, ...event.draft },
      };
    case "action-started":
      return { ...state, error: null };
    case "action-failed":
      return { ...state, error: event.error };
  }
}
