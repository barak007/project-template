import { z } from "zod";

import { jsonValueSchema } from "../../../domain-server/entities/common.js";

export const columnReferenceSchema = z.object({
  table: z.string(),
  column: z.string(),
  onDelete: z.string().optional(),
});

export const columnMetaSchema = z.object({
  key: z.string(),
  dataType: z.enum(["string", "number", "boolean", "date", "json"]),
  notNull: z.boolean(),
  hasDefault: z.boolean(),
  primaryKey: z.boolean(),
  redacted: z.boolean(),
  enumValues: z.array(z.string()).optional(),
  references: columnReferenceSchema.optional(),
});

export type ColumnReference = z.infer<typeof columnReferenceSchema>;

export const tableMetaSchema = z.object({
  name: z.string(),
  columns: z.array(columnMetaSchema),
  primaryKey: z.array(z.string()),
});

export type ColumnMeta = z.infer<typeof columnMetaSchema>;
export type TableMeta = z.infer<typeof tableMetaSchema>;

/** Rows are JSON-safe by construction: the service serializes dates to ISO. */
export const rowSchema = z.record(z.string(), jsonValueSchema);

export const rowsPageSchema = z.object({
  rows: z.array(rowSchema),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
});

export type TableRow = z.infer<typeof rowSchema>;
export type RowsPage = z.infer<typeof rowsPageSchema>;

/**
 * Wire aliases for the route responses: hc walks response types across the
 * whole route tree, and the recursive JsonValue rows blow its instantiation
 * depth. Responses are typed shallow on the wire and re-typed on the client
 * boundary (the same pattern as domain-client/api.ts).
 */
export type TableRowWire = Record<string, unknown>;
export type RowsPageWire = {
  rows: TableRowWire[];
  total: number;
  limit: number;
  offset: number;
};

export const filterOperatorSchema = z.enum([
  "eq",
  "ne",
  "contains",
  "not-contains",
  "starts-with",
  "ends-with",
  "ieq",
  "gt",
  "gte",
  "lt",
  "lte",
  "null",
  "not-null",
]);

export const rowFilterSchema = z.object({
  column: z.string(),
  op: filterOperatorSchema,
  value: jsonValueSchema.optional(),
});

export type RowFilter = z.infer<typeof rowFilterSchema>;

/**
 * `filters` arrives JSON-encoded because it is a query-string parameter;
 * the route decodes it against rowFilterSchema.
 */
export const listRowsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.string().optional(),
  dir: z.enum(["asc", "desc"]).optional(),
  filters: z.string().optional(),
});

export type ListRowsQuery = {
  limit: number;
  offset: number;
  sort?: string | undefined;
  dir?: "asc" | "desc" | undefined;
  filters: RowFilter[];
};

export const rowValuesSchema = z.record(z.string(), jsonValueSchema);
export type RowValues = z.infer<typeof rowValuesSchema>;

export const insertRowBodySchema = z.object({ values: rowValuesSchema });
export const updateRowBodySchema = z.object({
  key: rowValuesSchema,
  values: rowValuesSchema,
});
export const deleteRowBodySchema = z.object({ key: rowValuesSchema });
