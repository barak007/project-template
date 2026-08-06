import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  ilike,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
} from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

import type { Database } from "../../../domain-server/db/client.js";
import type { JsonValue } from "../../../domain-server/db/schema.js";
import { AppError } from "../../../domain-server/errors.js";
import type { ListRowsQuery, RowFilter } from "../entities/data.js";
import type { AdminTable, ColumnMeta } from "../tables.js";

const REDACTED = "[redacted]";

// Authorization happens at the route boundary (requireBackofficeAdmin), so
// these functions receive pre-authorized calls.

function columnMeta(adminTable: AdminTable, key: string): ColumnMeta {
  const meta = adminTable.meta.columns.find((column) => column.key === key);
  if (!meta)
    throw new AppError(
      "VALIDATION_FAILED",
      `Unknown column "${key}" on table "${adminTable.meta.name}"`,
      400,
    );
  return meta;
}

function liveColumn(adminTable: AdminTable, key: string): PgColumn {
  const column = adminTable.columns[key];
  if (!column)
    throw new AppError(
      "VALIDATION_FAILED",
      `Unknown column "${key}" on table "${adminTable.meta.name}"`,
      400,
    );
  return column;
}

/** Converts a JSON wire value into what the column's driver expects. */
function coerceValue(meta: ColumnMeta, value: JsonValue): unknown {
  if (value === null) return null;
  switch (meta.dataType) {
    case "date": {
      if (typeof value !== "string" || Number.isNaN(Date.parse(value))) break;
      return new Date(value);
    }
    case "number":
      if (typeof value !== "number") break;
      return value;
    case "boolean":
      if (typeof value !== "boolean") break;
      return value;
    case "string":
      if (typeof value !== "string") break;
      if (meta.enumValues && !meta.enumValues.includes(value)) break;
      return value;
    case "json":
      return value;
  }
  throw new AppError(
    "VALIDATION_FAILED",
    `Invalid value for column "${meta.key}" (${meta.dataType})`,
    400,
  );
}

function filterCondition(adminTable: AdminTable, filter: RowFilter): SQL {
  const meta = columnMeta(adminTable, filter.column);
  const column = liveColumn(adminTable, filter.column);
  if (meta.redacted)
    throw new AppError(
      "VALIDATION_FAILED",
      `Column "${meta.key}" cannot be filtered`,
      400,
    );

  if (filter.op === "null") return isNull(column);
  if (filter.op === "not-null") return isNotNull(column);

  if (filter.value === undefined || filter.value === null)
    throw new AppError(
      "VALIDATION_FAILED",
      `Filter on "${meta.key}" requires a value`,
      400,
    );
  if (filter.op === "contains") {
    if (meta.dataType !== "string" || typeof filter.value !== "string")
      throw new AppError(
        "VALIDATION_FAILED",
        `"contains" only applies to text columns`,
        400,
      );
    return ilike(column, `%${filter.value.replaceAll(/[%_\\]/g, "\\$&")}%`);
  }
  if (meta.dataType === "json")
    throw new AppError(
      "VALIDATION_FAILED",
      `Column "${meta.key}" only supports null / not-null filters`,
      400,
    );

  const value = coerceValue(meta, filter.value);
  switch (filter.op) {
    case "eq":
      return eq(column, value);
    case "ne":
      return ne(column, value);
    case "gt":
      return gt(column, value);
    case "gte":
      return gte(column, value);
    case "lt":
      return lt(column, value);
    case "lte":
      return lte(column, value);
  }
}

function orderFor(adminTable: AdminTable, query: ListRowsQuery): SQL[] {
  const hasCreatedAt = adminTable.meta.columns.some(
    (column) => column.key === "createdAt",
  );
  const sortKey =
    query.sort ??
    (hasCreatedAt ? "createdAt" : (adminTable.meta.primaryKey[0] ?? ""));
  const meta = columnMeta(adminTable, sortKey);
  if (meta.redacted)
    throw new AppError(
      "VALIDATION_FAILED",
      `Column "${meta.key}" cannot be sorted`,
      400,
    );
  const direction = query.dir ?? (query.sort ? "asc" : "desc");
  const order =
    direction === "asc"
      ? asc(liveColumn(adminTable, sortKey))
      : desc(liveColumn(adminTable, sortKey));
  // Primary-key tiebreak keeps pagination stable under non-unique sorts.
  const tiebreaks = adminTable.meta.primaryKey
    .filter((key) => key !== sortKey)
    .map((key) => asc(liveColumn(adminTable, key)));
  return [order, ...tiebreaks];
}

function serializeRow(
  adminTable: AdminTable,
  row: Record<string, unknown>,
): Record<string, JsonValue> {
  return Object.fromEntries(
    adminTable.meta.columns.map((column) => {
      const value = row[column.key];
      if (value === null || value === undefined) return [column.key, null];
      if (column.redacted) return [column.key, REDACTED];
      if (value instanceof Date) return [column.key, value.toISOString()];
      return [column.key, value as JsonValue];
    }),
  );
}

export async function listRows(
  db: Database,
  adminTable: AdminTable,
  query: ListRowsQuery,
) {
  const conditions = query.filters.map((filter) =>
    filterCondition(adminTable, filter),
  );
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(adminTable.table)
    .where(where)
    .orderBy(...orderFor(adminTable, query))
    .limit(query.limit)
    .offset(query.offset);
  const [counted] = await db
    .select({ total: count() })
    .from(adminTable.table)
    .where(where);

  return {
    rows: rows.map((row) =>
      serializeRow(adminTable, row as Record<string, unknown>),
    ),
    total: counted?.total ?? 0,
    limit: query.limit,
    offset: query.offset,
  };
}

function coerceValues(
  adminTable: AdminTable,
  values: Record<string, JsonValue>,
  options: { allowPrimaryKey: boolean },
): Record<string, unknown> {
  const coerced: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    const meta = columnMeta(adminTable, key);
    if (meta.redacted)
      throw new AppError(
        "VALIDATION_FAILED",
        `Column "${key}" cannot be written`,
        400,
      );
    if (meta.primaryKey && !options.allowPrimaryKey)
      throw new AppError(
        "VALIDATION_FAILED",
        `Primary-key column "${key}" cannot be updated`,
        400,
      );
    coerced[key] = coerceValue(meta, value);
  }
  return coerced;
}

/** Builds the WHERE for a row identified by its full primary key. */
function primaryKeyCondition(
  adminTable: AdminTable,
  key: Record<string, JsonValue>,
): SQL {
  const { primaryKey } = adminTable.meta;
  const provided = Object.keys(key);
  if (
    provided.length !== primaryKey.length ||
    !primaryKey.every((column) => provided.includes(column))
  )
    throw new AppError(
      "VALIDATION_FAILED",
      `Row key must be exactly [${primaryKey.join(", ")}]`,
      400,
    );
  const conditions = primaryKey.map((column) =>
    eq(
      liveColumn(adminTable, column),
      coerceValue(columnMeta(adminTable, column), key[column] ?? null),
    ),
  );
  const combined = and(...conditions);
  if (!combined) throw new AppError("VALIDATION_FAILED", "Empty row key", 400);
  return combined;
}

export async function insertRow(
  db: Database,
  adminTable: AdminTable,
  values: Record<string, JsonValue>,
) {
  // A required-but-redacted column (e.g. an encrypted secret value) makes the
  // whole table insert-only through the application, never the backoffice.
  const unfillable = adminTable.meta.columns.find(
    (column) => column.notNull && !column.hasDefault && column.redacted,
  );
  if (unfillable)
    throw new AppError(
      "VALIDATION_FAILED",
      `Rows in "${adminTable.meta.name}" carry secret material ("${unfillable.key}") and can only be created by the application`,
      400,
    );
  const missing = adminTable.meta.columns.filter(
    (column) =>
      column.notNull && !column.hasDefault && values[column.key] === undefined,
  );
  if (missing.length > 0)
    throw new AppError(
      "VALIDATION_FAILED",
      `Missing required columns: ${missing.map((column) => column.key).join(", ")}`,
      400,
    );
  const coerced = coerceValues(adminTable, values, { allowPrimaryKey: true });
  const [row] = await db.insert(adminTable.table).values(coerced).returning();
  return serializeRow(adminTable, row as Record<string, unknown>);
}

export async function updateRow(
  db: Database,
  adminTable: AdminTable,
  key: Record<string, JsonValue>,
  values: Record<string, JsonValue>,
) {
  if (Object.keys(values).length === 0)
    throw new AppError("VALIDATION_FAILED", "No columns to update", 400);
  const coerced = coerceValues(adminTable, values, { allowPrimaryKey: false });
  const updatedAt = adminTable.meta.columns.some(
    (column) => column.key === "updatedAt" && !(column.key in coerced),
  );
  const [row] = await db
    .update(adminTable.table)
    .set(updatedAt ? { ...coerced, updatedAt: new Date() } : coerced)
    .where(primaryKeyCondition(adminTable, key))
    .returning();
  if (!row) throw new AppError("NOT_FOUND", "Row not found", 404);
  return serializeRow(adminTable, row);
}

export async function deleteRow(
  db: Database,
  adminTable: AdminTable,
  key: Record<string, JsonValue>,
) {
  const deleted = await db
    .delete(adminTable.table)
    .where(primaryKeyCondition(adminTable, key))
    .returning();
  if (deleted.length === 0)
    throw new AppError("NOT_FOUND", "Row not found", 404);
}
