import type { AppEvent } from "./events.js";
import type { AppOwnState } from "./state.js";

/** Adding a key that is already there would leak a duplicate on removal. */
function including(keys: readonly string[], key: string): readonly string[] {
  return keys.includes(key) ? keys : [...keys, key];
}

function excluding(keys: readonly string[], key: string): readonly string[] {
  return keys.includes(key) ? keys.filter((each) => each !== key) : keys;
}

/**
 * An action settling records both facts at once: it is no longer in flight, and
 * — for a load — the collection it filled has now been asked for.
 */
function settle(
  state: AppOwnState,
  event: { key?: string; loaded?: string },
): AppOwnState {
  const pending =
    event.key === undefined
      ? state.pending
      : excluding(state.pending, event.key);
  const loaded =
    event.loaded === undefined
      ? state.loaded
      : including(state.loaded, event.loaded);
  return pending === state.pending && loaded === state.loaded
    ? state
    : { ...state, pending, loaded };
}

/** The one place the app's own slices change: a pure fold of events. */
export function reduce(state: AppOwnState, event: AppEvent): AppOwnState {
  switch (event.type) {
    case "navigated":
      // Moving to another page abandons whatever the last one failed at, and
      // whatever it had half-opened: a confirmation or a form does not follow
      // the user to a page where it would act on something else.
      return {
        ...state,
        route: event.route,
        error: null,
        confirming: null,
        openForm: null,
      };
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
    case "repository-draft-changed":
      return { ...state, repositoryDraft: event.remote };
    case "invite-draft-changed":
      return {
        ...state,
        inviteDraft: { ...state.inviteDraft, ...event.draft },
      };
    case "create-form-opened":
      return { ...state, openForm: event.form, confirming: null };
    case "create-form-closed":
      return { ...state, openForm: null };
    case "confirmation-asked":
      // One confirmation at a time: asking about a second row drops the first,
      // so there is never more than one armed delete on the page.
      return { ...state, confirming: event.key, openForm: null };
    case "confirmation-cancelled":
      return { ...state, confirming: null };
    case "error-dismissed":
      return { ...state, error: null };
    case "action-started":
      return {
        ...state,
        error: null,
        confirming: null,
        pending:
          event.key === undefined
            ? state.pending
            : including(state.pending, event.key),
      };
    case "action-finished":
      return settle(state, event);
    case "action-failed":
      // A load that failed has still been asked for: the page should say what
      // went wrong, not sit on a skeleton forever.
      return { ...settle(state, event), error: event.error };
  }
}
