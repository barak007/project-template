import type { RowFilter } from "../server/entities/data.js";

import type { ColumnMeta } from "./api.js";
import { defaultTableQuery } from "./data-actions.js";
import type { TableQuery } from "./data-actions.js";
import { textRowFilter } from "./filter-query.js";

/**
 * Per-column filter drafts, keyed by column (plus ":from"/":to" for date
 * ranges). Drafts are strings straight from the inputs; buildFilters turns
 * the non-empty ones into typed row filters.
 */
export type FilterDrafts = Record<string, string>;

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
