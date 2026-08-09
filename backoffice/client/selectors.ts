import type { TableMeta } from "./api.js";

export type IncomingReference = {
  table: string;
  column: string;
  onDelete?: string | undefined;
};

/**
 * Every foreign key across the schema that points at `tableName`, derived
 * from the loaded table metadata — the "referenced by" side of the graph.
 */
export function referencesTo(
  tables: TableMeta[],
  tableName: string,
): IncomingReference[] {
  return tables.flatMap((table) =>
    table.columns
      .filter((column) => column.references?.table === tableName)
      .map((column) => ({
        table: table.name,
        column: column.key,
        onDelete: column.references?.onDelete,
      })),
  );
}
