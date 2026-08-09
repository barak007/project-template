import type { Store } from "../../client/store.js";

import type { BackofficeEvent } from "./events.js";
import { emptyUserDraft, initialAdminState } from "./state.js";
import type { BackofficeState } from "./state.js";

export type BackofficeStore = Store<BackofficeState, BackofficeEvent>;

export function reduce(
  state: BackofficeState,
  event: BackofficeEvent,
): BackofficeState {
  switch (event.type) {
    case "auth-status-loaded":
      return {
        ...state,
        auth:
          event.authenticated && event.email !== undefined
            ? { status: "authenticated", email: event.email }
            : event.configured
              ? { status: "anonymous" }
              : { status: "needs-setup" },
      };
    case "signed-in":
      return {
        ...initialAdminState,
        route: state.route,
        auth: { status: "authenticated", email: event.email },
      };
    case "auth-failed":
      return {
        ...state,
        auth: {
          status:
            state.auth.status === "needs-setup" ? "needs-setup" : "anonymous",
          error: event.error,
        },
      };
    // Signing out wipes the admin data with it.
    case "signed-out":
      return {
        ...initialAdminState,
        route: state.route,
        auth: { status: "anonymous" },
      };
    case "navigated":
      return { ...state, route: event.route };
    case "user-draft-set":
      return {
        ...state,
        userEditor: {
          ...state.userEditor,
          draft: { ...state.userEditor.draft, ...event.draft },
        },
      };
    case "user-editor-reset":
      return {
        ...state,
        userEditor: { draft: emptyUserDraft, error: null },
      };
    case "user-mutation-failed":
      return {
        ...state,
        userEditor: { ...state.userEditor, error: event.error },
      };
    case "user-detail-loaded":
      return { ...state, userDetail: event.detail };
    case "organization-detail-loaded":
      return { ...state, organizationDetail: event.detail };
    case "tables-loaded":
      return { ...state, tables: event.tables };
    case "table-rows-loaded":
      return {
        ...state,
        tableData: {
          table: event.table,
          query: event.query,
          page: event.page,
        },
      };
  }
}
