import type { RowFilter } from "../server/entities/data.js";

/** The active filters as one readable line, e.g. "email contains foo, role eq admin". */
export function filterSummary(filters: RowFilter[]): string {
  return filters
    .map(
      (filter) =>
        `${filter.column} ${filter.op}${
          filter.value === undefined || filter.value === null
            ? ""
            : ` ${typeof filter.value === "object" ? JSON.stringify(filter.value) : String(filter.value)}`
        }`,
    )
    .join(", ");
}
