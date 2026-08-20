import type { Store } from "../../domain-client/store.js";

import type { BackofficeEvent } from "./events.js";
import { emptyUserDraft, initialAdminState } from "./state.js";
import type { BackofficeState } from "./state.js";
import { tableViewOnNavigate } from "./table-view.js";
import type { TableQuery, TableViewState } from "./table-view.js";

export type BackofficeStore = Store<BackofficeState, BackofficeEvent>;

/** Applies a query change to the open table view; without one, a no-op. */
function withQuery(
  state: BackofficeState,
  change: (view: TableViewState) => Partial<TableQuery>,
): BackofficeState {
  const view = state.tableView;
  if (!view) return state;
  return {
    ...state,
    tableView: { ...view, query: { ...view.query, ...change(view) } },
  };
}

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
        tableView: tableViewOnNavigate(null, state.route),
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
        tableView: tableViewOnNavigate(null, state.route),
        auth: { status: "anonymous" },
      };
    case "navigated":
      return {
        ...state,
        route: event.route,
        tableView: tableViewOnNavigate(state.tableView, event.route),
      };
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
    case "table-draft-set":
      return state.tableView
        ? {
            ...state,
            tableView: {
              ...state.tableView,
              drafts: { ...state.tableView.drafts, [event.key]: event.value },
            },
          }
        : state;
    // Every query change returns to the first page: the reader is asking a
    // new question, and the old offset may not even exist under it.
    case "table-filters-applied":
      return withQuery(state, () => ({ offset: 0, filters: event.filters }));
    case "table-filters-cleared":
      return state.tableView
        ? {
            ...state,
            tableView: {
              ...state.tableView,
              routeFilters: [],
              drafts: {},
              query: { ...state.tableView.query, offset: 0, filters: [] },
            },
          }
        : state;
    case "table-sorted":
      return withQuery(state, (view) => ({
        offset: 0,
        sort: event.column,
        dir:
          view.query.sort === event.column && view.query.dir === "asc"
            ? "desc"
            : "asc",
      }));
    case "table-limit-set":
      return withQuery(state, () => ({ offset: 0, limit: event.limit }));
    case "table-page-turned":
      return withQuery(state, (view) => ({
        offset:
          event.direction === "next"
            ? view.query.offset + view.query.limit
            : Math.max(0, view.query.offset - view.query.limit),
      }));
  }
}
