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
    // A fresh list means the last mutation (if any) succeeded, so the
    // page-level error clears with it.
    case "users-loaded":
      return {
        ...state,
        users: event.users,
        usersPage: { ...state.usersPage, error: null },
      };
    case "users-filter-set":
      return {
        ...state,
        usersPage: { ...state.usersPage, filter: event.filter },
      };
    case "user-editor-toggled":
      return {
        ...state,
        usersPage: {
          ...state.usersPage,
          editorOpen: event.open,
          draft: emptyUserDraft,
          error: null,
        },
      };
    case "user-draft-set":
      return {
        ...state,
        usersPage: {
          ...state.usersPage,
          draft: { ...state.usersPage.draft, ...event.draft },
        },
      };
    case "user-mutation-failed":
      return {
        ...state,
        usersPage: { ...state.usersPage, error: event.error },
      };
    case "user-detail-loaded":
      return { ...state, userDetail: event.detail };
    case "organizations-loaded":
      return {
        ...state,
        organizations: event.organizations,
        organizationsPage: { ...state.organizationsPage, error: null },
      };
    case "organizations-filter-set":
      return {
        ...state,
        organizationsPage: {
          ...state.organizationsPage,
          filter: event.filter,
        },
      };
    case "organization-draft-set":
      return {
        ...state,
        organizationsPage: {
          ...state.organizationsPage,
          draftName: event.name,
        },
      };
    case "organization-mutation-failed":
      return {
        ...state,
        organizationsPage: { ...state.organizationsPage, error: event.error },
      };
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
