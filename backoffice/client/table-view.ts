import type { RowFilter } from "../server/entities/data.js";

import type { ColumnMeta, TableRow } from "./api.js";
import { textRowFilter } from "./filter-query.js";
import type { Route } from "./router.js";
import type { BackofficeError } from "./state.js";

export type TableQuery = {
  limit: number;
  offset: number;
  sort?: string | undefined;
  dir?: "asc" | "desc" | undefined;
  filters: RowFilter[];
};

export const defaultTableQuery: TableQuery = {
  limit: 50,
  offset: 0,
  filters: [],
};

/**
 * Per-column filter drafts, keyed by column (plus ":from"/":to" for date
 * ranges). Drafts are strings straight from the inputs; buildFilters turns
 * the non-empty ones into typed row filters.
 */
export type FilterDrafts = Record<string, string>;

/** The row editor over the table: inserting a new row or editing one. */
export type TableEditor = { mode: "insert" } | { mode: "edit"; row: TableRow };

/**
 * Everything the open table page shows or edits besides the rows themselves:
 * the query being asked, the filter drafts under the column headers, the
 * filters the route arrived with (a followed foreign-key link), which the URL
 * keeps carrying while the query changes underneath, the open row editor,
 * and the last mutation failure.
 */
export type TableViewState = {
  table: string;
  routeFilters: RowFilter[];
  query: TableQuery;
  drafts: FilterDrafts;
  editor: TableEditor | null;
  error: BackofficeError | null;
};

/**
 * The view a navigation lands on. Opening another table (or the same table
 * through a different foreign-key link) starts a fresh view from the route;
 * a navigation to the same table and filters — the URL mirroring a page turn,
 * or an idempotent link — keeps the view, so drafts and sorting survive it.
 */
export function tableViewOnNavigate(
  current: TableViewState | null,
  route: Route,
): TableViewState | null {
  if (route.kind !== "table") return current;
  const filters = route.filters ?? [];
  if (
    current?.table === route.table &&
    JSON.stringify(current.routeFilters) === JSON.stringify(filters)
  )
    return current;
  return {
    table: route.table,
    routeFilters: filters,
    query: tableQueryFromRoute(route),
    drafts: {},
    editor: null,
    error: null,
  };
}

export function buildFilters(
  columns: ColumnMeta[],
  drafts: FilterDrafts,
): RowFilter[] {
  const filters: RowFilter[] = [];
  for (const column of columns) {
    if (column.redacted) continue;
    if (column.dataType === "date") {
      const from = drafts[`${column.key}:from`];
      const to = drafts[`${column.key}:to`];
      if (from) filters.push({ column: column.key, op: "gte", value: from });
      if (to) filters.push({ column: column.key, op: "lte", value: to });
      continue;
    }
    const draft = drafts[column.key];
    if (!draft) continue;
    switch (column.dataType) {
      case "string": {
        if (column.enumValues) {
          filters.push({ column: column.key, op: "eq", value: draft });
          break;
        }
        const filter = textRowFilter(column.key, draft);
        if (filter) filters.push(filter);
        break;
      }
      case "boolean":
        filters.push({ column: column.key, op: "eq", value: draft === "true" });
        break;
      case "number": {
        const value = Number(draft);
        if (!Number.isNaN(value))
          filters.push({ column: column.key, op: "eq", value });
        break;
      }
      case "json":
        break;
    }
  }
  return filters;
}

/** The query a table route asks for: its filters and page over the defaults. */
export function tableQueryFromRoute(route: {
  filters?: RowFilter[] | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}): TableQuery {
  return {
    ...defaultTableQuery,
    ...(route.limit === undefined ? {} : { limit: route.limit }),
    ...(route.offset === undefined ? {} : { offset: route.offset }),
    filters: route.filters ?? [],
  };
}
