import type { createBackofficeNavigation } from "./navigation-actions.js";
import type { BackofficeStore } from "./projection.js";
import { buildFilters } from "./table-view.js";

type Navigation = ReturnType<typeof createBackofficeNavigation>;

/**
 * Everything a user does to the open table view besides reading rows:
 * filter drafts, applying and clearing filters, sorting, and pagination.
 * Each change also mirrors the page onto the URL (replace, not push — turning
 * a page is state, not a navigation step), so a reload or a shared link lands
 * on the same page; the projection keeps the view when that mirrored route
 * loops back in.
 */
export function createTableViewActions(
  store: BackofficeStore,
  navigation: Navigation,
) {
  const mirror = () => {
    const view = store.getState().tableView;
    if (!view) return;
    navigation.replace({
      kind: "table",
      table: view.table,
      ...(view.routeFilters.length > 0 ? { filters: view.routeFilters } : {}),
      limit: view.query.limit,
      offset: view.query.offset,
    });
  };

  return {
    setDraft: (key: string, value: string) => {
      store.dispatch({ type: "table-draft-set", key, value });
    },
    /**
     * Turns the drafts into row filters against the loaded column metadata.
     * Untouched drafts (none edited since the view opened) are a no-op, so a
     * debounced caller can never wipe the filters a route arrived with.
     */
    applyFilters: () => {
      const { tableView, tables } = store.getState();
      if (!tableView || Object.keys(tableView.drafts).length === 0) return;
      const columns =
        tables.find((table) => table.name === tableView.table)?.columns ?? [];
      store.dispatch({
        type: "table-filters-applied",
        filters: buildFilters(columns, tableView.drafts),
      });
      mirror();
    },
    /** Sorts by the column, flipping direction on a repeat; redacted columns
     *  are not sortable (the server would reject the query). */
    toggleSort: (column: string) => {
      const { tableView, tables } = store.getState();
      if (!tableView) return;
      const meta = tables
        .find((table) => table.name === tableView.table)
        ?.columns.find((candidate) => candidate.key === column);
      if (!meta || meta.redacted) return;
      store.dispatch({ type: "table-sorted", column });
      mirror();
    },
    /** Drops drafts, applied filters, and route filters; leaving a followed
     *  foreign-key link is a navigation step, so that case pushes. */
    clearFilters: () => {
      const view = store.getState().tableView;
      if (!view) return;
      const hadRouteFilters = view.routeFilters.length > 0;
      store.dispatch({ type: "table-filters-cleared" });
      if (hadRouteFilters)
        navigation.navigate({ kind: "table", table: view.table });
      mirror();
    },
    setLimit: (limit: number) => {
      store.dispatch({ type: "table-limit-set", limit });
      mirror();
    },
    nextPage: () => {
      store.dispatch({ type: "table-page-turned", direction: "next" });
      mirror();
    },
    previousPage: () => {
      store.dispatch({ type: "table-page-turned", direction: "previous" });
      mirror();
    },
  };
}
