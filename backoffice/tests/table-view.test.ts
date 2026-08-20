import { describe, expect, it } from "vitest";

import type { ColumnMeta } from "../client/index.js";
import { buildFilters, tableQueryFromRoute } from "../client/table-view.js";

function column(overrides: Partial<ColumnMeta> & { key: string }): ColumnMeta {
  return {
    dataType: "string",
    notNull: false,
    hasDefault: false,
    primaryKey: false,
    redacted: false,
    ...overrides,
  };
}

describe("buildFilters", () => {
  it("turns text drafts into filter-query row filters", () => {
    const columns = [column({ key: "name" }), column({ key: "email" })];
    expect(buildFilters(columns, { name: "^acme", email: "!test" })).toEqual([
      { column: "name", op: "starts-with", value: "acme" },
      { column: "email", op: "not-contains", value: "test" },
    ]);
  });

  it("skips empty drafts and text drafts that filter nothing", () => {
    const columns = [column({ key: "name" }), column({ key: "email" })];
    expect(buildFilters(columns, {})).toEqual([]);
    expect(buildFilters(columns, { name: "", email: "!" })).toEqual([]);
  });

  it("matches enum columns exactly instead of parsing filter syntax", () => {
    const columns = [
      column({ key: "status", enumValues: ["active", "disabled"] }),
    ];
    expect(buildFilters(columns, { status: "active" })).toEqual([
      { column: "status", op: "eq", value: "active" },
    ]);
  });

  it("builds date range bounds from the :from/:to drafts", () => {
    const columns = [column({ key: "createdAt", dataType: "date" })];
    expect(
      buildFilters(columns, {
        "createdAt:from": "2026-01-01",
        "createdAt:to": "2026-02-01",
      }),
    ).toEqual([
      { column: "createdAt", op: "gte", value: "2026-01-01" },
      { column: "createdAt", op: "lte", value: "2026-02-01" },
    ]);
    expect(buildFilters(columns, { "createdAt:to": "2026-02-01" })).toEqual([
      { column: "createdAt", op: "lte", value: "2026-02-01" },
    ]);
  });

  it("coerces boolean and number drafts to typed values", () => {
    const columns = [
      column({ key: "verified", dataType: "boolean" }),
      column({ key: "attempts", dataType: "number" }),
    ];
    expect(buildFilters(columns, { verified: "true", attempts: "3" })).toEqual([
      { column: "verified", op: "eq", value: true },
      { column: "attempts", op: "eq", value: 3 },
    ]);
    expect(buildFilters(columns, { verified: "false" })).toEqual([
      { column: "verified", op: "eq", value: false },
    ]);
  });

  it("drops number drafts that are not numbers", () => {
    const columns = [column({ key: "attempts", dataType: "number" })];
    expect(buildFilters(columns, { attempts: "many" })).toEqual([]);
  });

  it("never filters redacted or json columns", () => {
    const columns = [
      column({ key: "secret", redacted: true }),
      column({ key: "payload", dataType: "json" }),
    ];
    expect(buildFilters(columns, { secret: "abc", payload: "abc" })).toEqual(
      [],
    );
  });
});

describe("tableQueryFromRoute", () => {
  it("starts from the default query when the route carries nothing", () => {
    expect(tableQueryFromRoute({})).toEqual({
      limit: 50,
      offset: 0,
      filters: [],
    });
  });

  it("keeps the route's filters and page over the defaults", () => {
    const filters = [
      { column: "name", op: "contains" as const, value: "acme" },
    ];
    expect(tableQueryFromRoute({ filters, limit: 100, offset: 200 })).toEqual({
      limit: 100,
      offset: 200,
      filters,
    });
  });

  it("takes each page parameter independently", () => {
    expect(tableQueryFromRoute({ offset: 50 })).toEqual({
      limit: 50,
      offset: 50,
      filters: [],
    });
    expect(tableQueryFromRoute({ limit: 25 })).toEqual({
      limit: 25,
      offset: 0,
      filters: [],
    });
  });
});
