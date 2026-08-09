import type { RowFilter } from "../server/entities/data.js";

import { defaultTableQuery } from "./data-actions.js";

/**
 * Routing is headless: routes are plain values, and the mapping to and from
 * URL paths lives here so the UI never parses locations itself.
 */
export type Route =
  | { kind: "users" }
  | { kind: "user"; userId: string }
  | { kind: "organizations" }
  | { kind: "organization"; organizationId: string }
  | {
      kind: "table";
      table: string;
      filters?: RowFilter[];
      limit?: number;
      offset?: number;
    };

export const defaultRoute: Route = { kind: "users" };

export function routeToPath(route: Route): string {
  switch (route.kind) {
    case "users":
      return "/users";
    case "user":
      return `/users/${encodeURIComponent(route.userId)}`;
    case "organizations":
      return "/organizations";
    case "organization":
      return `/organizations/${encodeURIComponent(route.organizationId)}`;
    case "table": {
      const base = `/tables/${encodeURIComponent(route.table)}`;
      const params: string[] = [];
      if (route.filters && route.filters.length > 0)
        params.push(
          `filters=${encodeURIComponent(JSON.stringify(route.filters))}`,
        );
      // Default pagination stays out of the URL so plain links stay clean.
      if (route.limit !== undefined && route.limit !== defaultTableQuery.limit)
        params.push(`limit=${String(route.limit)}`);
      if (
        route.offset !== undefined &&
        route.offset !== defaultTableQuery.offset
      )
        params.push(`offset=${String(route.offset)}`);
      return params.length > 0 ? `${base}?${params.join("&")}` : base;
    }
  }
}

function isRowFilter(value: unknown): value is RowFilter {
  return (
    typeof value === "object" &&
    value !== null &&
    "column" in value &&
    typeof value.column === "string" &&
    "op" in value &&
    typeof value.op === "string"
  );
}

/**
 * Filters ride the query string as JSON. This only guards the shape —
 * the server validates every filter against its schema anyway.
 */
function filtersFromSearch(search: string): RowFilter[] | undefined {
  for (const pair of search.split("&")) {
    const [key, ...rest] = pair.split("=");
    if (key !== "filters") continue;
    try {
      const parsed: unknown = JSON.parse(decodeURIComponent(rest.join("=")));
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        parsed.every(isRowFilter)
      )
        return parsed;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** Reads a non-negative integer query param; anything else is ignored. */
function pageParamFromSearch(search: string, key: string): number | undefined {
  for (const pair of search.split("&")) {
    const [name, ...rest] = pair.split("=");
    if (name !== key) continue;
    const value = Number(decodeURIComponent(rest.join("=")));
    if (Number.isInteger(value) && value >= 0) return value;
  }
  return undefined;
}

/** Unknown paths land on the default route rather than a dead end. */
export function pathToRoute(path: string): Route {
  const [pathname = "", search = ""] = path.split("?");
  const [first, second] = pathname
    .split("/")
    .filter(Boolean)
    .map(decodeURIComponent);
  if (first === "users" && second !== undefined)
    return { kind: "user", userId: second };
  if (first === "organizations" && second !== undefined)
    return { kind: "organization", organizationId: second };
  if (first === "organizations") return { kind: "organizations" };
  if (first === "tables" && second !== undefined) {
    const filters = filtersFromSearch(search);
    const limit = pageParamFromSearch(search, "limit");
    const offset = pageParamFromSearch(search, "offset");
    return {
      kind: "table",
      table: second,
      ...(filters ? { filters } : {}),
      ...(limit === undefined ? {} : { limit }),
      ...(offset === undefined ? {} : { offset }),
    };
  }
  return defaultRoute;
}
