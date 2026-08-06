import { getTableColumns, getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

import { schema } from "../../domain-server/db/schema.js";

export type ColumnDataType = "string" | "number" | "boolean" | "date" | "json";

export type ColumnMeta = {
  key: string;
  dataType: ColumnDataType;
  notNull: boolean;
  hasDefault: boolean;
  primaryKey: boolean;
  /** Masked in every response and rejected in every write. */
  redacted: boolean;
  enumValues?: string[];
};

export type TableMeta = {
  name: string;
  columns: ColumnMeta[];
  primaryKey: string[];
};

export type AdminTable = {
  meta: TableMeta;
  table: PgTable;
  /** Live drizzle columns by property key, for building queries. */
  columns: Record<string, PgColumn>;
};

// Secret material an operator must never read back: session/OAuth tokens,
// password hashes, verification codes, and encrypted tenant secrets.
const redactedColumns: Record<string, readonly string[]> = {
  session: ["token"],
  account: ["accessToken", "refreshToken", "idToken", "password"],
  verification: ["value"],
  organization_secrets: ["encryptedValue"],
  user_secrets: ["encryptedValue"],
  work_sessions: ["secretsSnapshot"],
};

function buildAdminTable(table: PgTable): AdminTable {
  const name = getTableName(table);
  const columns = getTableColumns(table) as Record<string, PgColumn>;
  const redacted = new Set(redactedColumns[name] ?? []);

  // Composite primary keys live in the table config, not on the columns.
  const compositeKeyColumnNames = new Set(
    getTableConfig(table).primaryKeys.flatMap((key) =>
      key.columns.map((column) => column.name),
    ),
  );

  const columnMetas = Object.entries(columns).map(
    ([key, column]): ColumnMeta => ({
      key,
      dataType: column.dataType as ColumnDataType,
      notNull: column.notNull,
      hasDefault: column.hasDefault,
      primaryKey: column.primary || compositeKeyColumnNames.has(column.name),
      redacted: redacted.has(key),
      ...(column.enumValues ? { enumValues: [...column.enumValues] } : {}),
    }),
  );

  return {
    meta: {
      name,
      columns: columnMetas,
      primaryKey: columnMetas
        .filter((column) => column.primaryKey)
        .map((column) => column.key),
    },
    table,
    columns,
  };
}

const registry = new Map<string, AdminTable>(
  Object.values(schema).map((table) => {
    const adminTable = buildAdminTable(table);
    return [adminTable.meta.name, adminTable];
  }),
);

export function listAdminTables(): TableMeta[] {
  return [...registry.values()]
    .map((entry) => entry.meta)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function findAdminTable(name: string): AdminTable | undefined {
  return registry.get(name);
}
