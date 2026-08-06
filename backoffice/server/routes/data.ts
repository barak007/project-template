import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { AppError } from "../../../domain-server/errors.js";
import { validationHook } from "../../../domain-server/http/validation.js";
import type { BackofficeDependencies } from "../dependencies.js";
import {
  deleteRowBodySchema,
  insertRowBodySchema,
  listRowsQuerySchema,
  rowFilterSchema,
  rowSchema,
  rowsPageSchema,
  tableMetaSchema,
  updateRowBodySchema,
} from "../entities/data.js";
import type {
  ListRowsQuery,
  RowsPageWire,
  TableRowWire,
} from "../entities/data.js";
import { deleteRow, insertRow, listRows, updateRow } from "../services/data.js";
import { requireBackofficeAdmin } from "../session.js";
import { findAdminTable, listAdminTables } from "../tables.js";

const tableParams = z.object({ table: z.string() });
const filtersSchema = z.array(rowFilterSchema);

function resolveTable(name: string) {
  const adminTable = findAdminTable(name);
  if (!adminTable)
    throw new AppError("NOT_FOUND", `Unknown table "${name}"`, 404);
  return adminTable;
}

/** The `filters` query parameter is a JSON-encoded array of row filters. */
function decodeFilters(encoded: string | undefined): ListRowsQuery["filters"] {
  if (!encoded) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(encoded);
  } catch {
    throw new AppError("VALIDATION_FAILED", "filters is not valid JSON", 400);
  }
  const result = filtersSchema.safeParse(parsed);
  if (!result.success)
    throw new AppError("VALIDATION_FAILED", "Invalid filters", 400, {
      issues: result.error.issues,
    });
  return result.data;
}

export function createBackofficeDataRoutes(
  dependencies: BackofficeDependencies,
) {
  const routes = new Hono();
  routes.use("*", requireBackofficeAdmin(dependencies));

  return routes
    .get("/tables", (context) =>
      context.json(z.array(tableMetaSchema).parse(listAdminTables()), 200),
    )
    .get(
      "/tables/:table/rows",
      zValidator("param", tableParams, validationHook),
      zValidator("query", listRowsQuerySchema, validationHook),
      async (context) => {
        const adminTable = resolveTable(context.req.valid("param").table);
        const { filters, ...page } = context.req.valid("query");
        const result = await listRows(dependencies.db, adminTable, {
          ...page,
          filters: decodeFilters(filters),
        });
        return context.json(rowsPageSchema.parse(result) as RowsPageWire, 200);
      },
    )
    .post(
      "/tables/:table/rows",
      zValidator("param", tableParams, validationHook),
      zValidator("json", insertRowBodySchema, validationHook),
      async (context) => {
        const adminTable = resolveTable(context.req.valid("param").table);
        const row = await insertRow(
          dependencies.db,
          adminTable,
          context.req.valid("json").values,
        );
        return context.json(rowSchema.parse(row) as TableRowWire, 201);
      },
    )
    .patch(
      "/tables/:table/rows",
      zValidator("param", tableParams, validationHook),
      zValidator("json", updateRowBodySchema, validationHook),
      async (context) => {
        const adminTable = resolveTable(context.req.valid("param").table);
        const body = context.req.valid("json");
        const row = await updateRow(
          dependencies.db,
          adminTable,
          body.key,
          body.values,
        );
        return context.json(rowSchema.parse(row) as TableRowWire, 200);
      },
    )
    .delete(
      "/tables/:table/rows",
      zValidator("param", tableParams, validationHook),
      zValidator("json", deleteRowBodySchema, validationHook),
      async (context) => {
        const adminTable = resolveTable(context.req.valid("param").table);
        await deleteRow(
          dependencies.db,
          adminTable,
          context.req.valid("json").key,
        );
        return context.body(null, 204);
      },
    );
}
