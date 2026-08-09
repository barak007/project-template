import type { RowFilter } from "../server/entities/data.js";

/**
 * Filter-query syntax for every text filter input, parsed once here and
 * mapped onto server row-filter ops:
 *
 *   abc      contains "abc"
 *   !abc     does NOT contain "abc" (rest is literal — no anchors after !)
 *   ^abc     starts with "abc"
 *   abc$     ends with "abc"
 *   ^abc$    equals "abc" (case-insensitive)
 *   \!abc    literal "!abc"; \^ likewise; a trailing \$ keeps the "$"
 *
 * Modifiers are only special at the edges (`a!b` is literal), and a query
 * that reduces to an empty term (`!`, `^`, `$`, `^$`) filters nothing.
 */
export type FilterMode =
  "contains" | "not-contains" | "starts-with" | "ends-with" | "equals";

export type ParsedFilter = { mode: FilterMode; term: string };

export const FILTER_SYNTAX_HINT =
  "abc contains · !abc excludes · ^abc starts with · abc$ ends with · ^abc$ exact · \\ escapes";

/** Parses a raw filter input; null means "match everything". */
export function parseFilterQuery(raw: string): ParsedFilter | null {
  let term = raw.trim();
  if (!term) return null;

  if (term.startsWith("!")) {
    term = term.slice(1);
    return term ? { mode: "not-contains", term } : null;
  }

  let startsWith = false;
  if (term.startsWith("\\!") || term.startsWith("\\^")) {
    term = term.slice(1);
  } else if (term.startsWith("^")) {
    startsWith = true;
    term = term.slice(1);
  }

  let endsWith = false;
  if (term.endsWith("\\$")) {
    term = `${term.slice(0, -2)}$`;
  } else if (term.endsWith("$")) {
    endsWith = true;
    term = term.slice(0, -1);
  }

  if (!term) return null;
  const mode: FilterMode =
    startsWith && endsWith
      ? "equals"
      : startsWith
        ? "starts-with"
        : endsWith
          ? "ends-with"
          : "contains";
  return { mode, term };
}

const MODE_TO_OP: Record<FilterMode, RowFilter["op"]> = {
  contains: "contains",
  "not-contains": "not-contains",
  "starts-with": "starts-with",
  "ends-with": "ends-with",
  equals: "ieq",
};

/** Maps a raw filter input onto a server row filter; null filters nothing. */
export function textRowFilter(column: string, raw: string): RowFilter | null {
  const parsed = parseFilterQuery(raw);
  if (!parsed) return null;
  return { column, op: MODE_TO_OP[parsed.mode], value: parsed.term };
}
