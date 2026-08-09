import { toApiError } from "../../client/errors.js";
import type { RowFilter, RowValues } from "../server/entities/data.js";

import type { Api, RowsPage } from "./api.js";
import type { BackofficeStore } from "./projection.js";

export type { RowFilter, RowValues } from "../server/entities/data.js";

export type TableQuery = {
  limit: number;
  offset: number;
  sort?: string | undefined;
  dir?: "asc" | "desc" | undefined;
  filters: RowFilter[];
};

export const defaultTableQuery: TableQuery = {
  limit: 50,
  offset: 0,
  filters: [],
};

export function createDataActions(api: Api, store: BackofficeStore) {
  const routes = api.data;

  const loadRows = async (table: string, query: TableQuery) => {
    const response = await routes.tables[":table"].rows.$get({
      param: { table },
      query: {
        limit: String(query.limit),
        offset: String(query.offset),
        ...(query.sort === undefined ? {} : { sort: query.sort }),
        ...(query.dir === undefined ? {} : { dir: query.dir }),
        ...(query.filters.length > 0
          ? { filters: JSON.stringify(query.filters) }
          : {}),
      },
    });
    if (!response.ok) throw await toApiError(response);
    // Responses are typed shallow on the wire (see server/entities/data.ts);
    // this boundary restores the precise recursive row type.
    store.dispatch({
      type: "table-rows-loaded",
      table,
      query,
      page: (await response.json()) as RowsPage,
    });
  };

  // Mutations refresh the loaded page themselves so the state can never show
  // stale rows — the UI only ever renders what the store holds.
  const refresh = async (table: string) => {
    const { tableData } = store.getState();
    if (tableData?.table === table) await loadRows(table, tableData.query);
  };

  return {
    /** Reloads the loaded page of `table`, if that is the loaded table. */
    refresh,
    loadTables: async () => {
      const response = await routes.tables.$get();
      if (!response.ok) throw await toApiError(response);
      store.dispatch({ type: "tables-loaded", tables: await response.json() });
    },
    loadRows,
    insertRow: async (table: string, values: RowValues) => {
      const response = await routes.tables[":table"].rows.$post({
        param: { table },
        json: { values },
      });
      if (!response.ok) throw await toApiError(response);
      await refresh(table);
    },
    updateRow: async (table: string, key: RowValues, values: RowValues) => {
      const response = await routes.tables[":table"].rows.$patch({
        param: { table },
        json: { key, values },
      });
      if (!response.ok) throw await toApiError(response);
      await refresh(table);
    },
    deleteRow: async (table: string, key: RowValues) => {
      const response = await routes.tables[":table"].rows.$delete({
        param: { table },
        json: { key },
      });
      if (!response.ok) throw await toApiError(response);
      await refresh(table);
    },
  };
}
