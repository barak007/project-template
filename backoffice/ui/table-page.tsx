import { useEffect, useState } from "react";

import { ApiError, defaultTableQuery } from "../client/index.js";
import type {
  BackofficeCore,
  ColumnMeta,
  RowFilter,
  TableQuery,
  TableRow,
} from "../client/index.js";

import { RowEditor } from "./row-editor.js";
import { useBackofficeState } from "./use-backoffice-state.js";

/**
 * Per-column filter drafts, keyed by column (plus ":from"/":to" for date
 * ranges). Drafts are strings straight from the inputs; buildFilters turns
 * the non-empty ones into typed row filters.
 */
type Drafts = Record<string, string>;

function buildFilters(columns: ColumnMeta[], drafts: Drafts): RowFilter[] {
  const filters: RowFilter[] = [];
  for (const column of columns) {
    if (column.redacted) continue;
    if (column.dataType === "date") {
      const from = drafts[`${column.key}:from`];
      const to = drafts[`${column.key}:to`];
      if (from) filters.push({ column: column.key, op: "gte", value: from });
      if (to) filters.push({ column: column.key, op: "lte", value: to });
      continue;
    }
    const draft = drafts[column.key];
    if (!draft) continue;
    switch (column.dataType) {
      case "string":
        filters.push(
          column.enumValues
            ? { column: column.key, op: "eq", value: draft }
            : { column: column.key, op: "contains", value: draft },
        );
        break;
      case "boolean":
        filters.push({ column: column.key, op: "eq", value: draft === "true" });
        break;
      case "number": {
        const value = Number(draft);
        if (!Number.isNaN(value))
          filters.push({ column: column.key, op: "eq", value });
        break;
      }
      case "json":
        break;
    }
  }
  return filters;
}

function formatCell(
  column: ColumnMeta,
  value: TableRow[string] | undefined,
): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  if (column.dataType === "date" && typeof value === "string")
    return new Date(value).toLocaleString();
  return String(value);
}

function rowKey(primaryKey: string[], row: TableRow): TableRow {
  return Object.fromEntries(
    primaryKey.map((column) => [column, row[column] ?? null]),
  );
}

type Editor = { mode: "insert" } | { mode: "edit"; row: TableRow };

export function TablePage({
  core,
  load,
  table,
}: {
  core: BackofficeCore;
  load: (action: () => Promise<void>) => Promise<void>;
  table: string;
}) {
  const meta = useBackofficeState(core, (state) =>
    state.tables.find((entry) => entry.name === table),
  );
  const tableData = useBackofficeState(core, (state) => state.tableData);

  const [query, setQuery] = useState<TableQuery>(defaultTableQuery);
  const [drafts, setDrafts] = useState<Drafts>({});
  const [editor, setEditor] = useState<Editor | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setQuery(defaultTableQuery);
    setDrafts({});
    setEditor(null);
    setError(null);
  }, [table]);

  useEffect(() => {
    void load(() => core.data.loadRows(table, query));
  }, [core, load, table, query]);

  if (!meta) return <p>Loading…</p>;
  const columns = meta.columns;
  const page = tableData?.table === table ? tableData.page : null;

  const applyFilters = () => {
    setQuery((current) => ({
      ...current,
      offset: 0,
      filters: buildFilters(columns, drafts),
    }));
  };

  const setDraft = (key: string, value: string) => {
    setDrafts((current) => ({ ...current, [key]: value }));
  };

  const toggleSort = (column: ColumnMeta) => {
    if (column.redacted) return;
    setQuery((current) => ({
      ...current,
      offset: 0,
      sort: column.key,
      dir:
        current.sort === column.key && current.dir === "asc" ? "desc" : "asc",
    }));
  };

  const run = async (action: () => Promise<void>) => {
    setError(null);
    try {
      await load(action);
      return true;
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "Something went wrong",
      );
      return false;
    }
  };

  const remove = (row: TableRow) => {
    if (!window.confirm("Delete this row? This cannot be undone.")) return;
    void run(() => core.data.deleteRow(table, rowKey(meta.primaryKey, row)));
  };

  const sortMarker = (column: ColumnMeta) =>
    query.sort === column.key ? (query.dir === "asc" ? " ▲" : " ▼") : "";

  const filterControl = (column: ColumnMeta) => {
    if (column.redacted || column.dataType === "json") return null;
    if (column.dataType === "date")
      return (
        <span className="date-range">
          <input
            type="datetime-local"
            title={`${column.key} from`}
            value={drafts[`${column.key}:from`] ?? ""}
            onChange={(event) => {
              setDraft(`${column.key}:from`, event.target.value);
            }}
            onBlur={applyFilters}
          />
          <input
            type="datetime-local"
            title={`${column.key} to`}
            value={drafts[`${column.key}:to`] ?? ""}
            onChange={(event) => {
              setDraft(`${column.key}:to`, event.target.value);
            }}
            onBlur={applyFilters}
          />
        </span>
      );
    if (column.enumValues || column.dataType === "boolean")
      return (
        <select
          value={drafts[column.key] ?? ""}
          onChange={(event) => {
            const next = { ...drafts, [column.key]: event.target.value };
            setDrafts(next);
            setQuery((current) => ({
              ...current,
              offset: 0,
              filters: buildFilters(columns, next),
            }));
          }}
        >
          <option value="">all</option>
          {(column.enumValues ?? ["true", "false"]).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      );
    return (
      <input
        type="search"
        placeholder="filter"
        value={drafts[column.key] ?? ""}
        onChange={(event) => {
          setDraft(column.key, event.target.value);
        }}
        onBlur={applyFilters}
        onKeyDown={(event) => {
          if (event.key === "Enter") applyFilters();
        }}
      />
    );
  };

  const from = page ? page.offset + 1 : 0;
  const to = page ? page.offset + page.rows.length : 0;
  const total = page?.total ?? 0;

  return (
    <section className="table-page">
      <header className="table-header">
        <h1>{table}</h1>
        <span className="spacer" />
        <button
          onClick={() => {
            setEditor({ mode: "insert" });
          }}
        >
          Add row
        </button>
      </header>

      {error ? <p className="error">{error}</p> : null}

      {editor ? (
        <RowEditor
          key={editor.mode === "edit" ? JSON.stringify(editor.row) : "insert"}
          meta={meta}
          row={editor.mode === "edit" ? editor.row : null}
          onCancel={() => {
            setEditor(null);
          }}
          onSave={async (values) => {
            const saved = await run(() =>
              editor.mode === "edit"
                ? core.data.updateRow(
                    table,
                    rowKey(meta.primaryKey, editor.row),
                    values,
                  )
                : core.data.insertRow(table, values),
            );
            if (saved) setEditor(null);
          }}
        />
      ) : null}

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={column.redacted ? "" : "sortable"}
                  onClick={() => {
                    toggleSort(column);
                  }}
                >
                  {column.key}
                  {sortMarker(column)}
                </th>
              ))}
              <th />
            </tr>
            <tr className="filters">
              {columns.map((column) => (
                <th key={column.key}>{filterControl(column)}</th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {page?.rows.map((row, index) => (
              <tr key={JSON.stringify(rowKey(meta.primaryKey, row)) + index}>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={column.redacted ? "redacted" : ""}
                    title={formatCell(column, row[column.key])}
                  >
                    {formatCell(column, row[column.key])}
                  </td>
                ))}
                <td className="row-actions">
                  <button
                    onClick={() => {
                      setEditor({ mode: "edit", row });
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="danger"
                    onClick={() => {
                      remove(row);
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {page?.rows.length === 0 ? (
              <tr>
                <td className="empty" colSpan={columns.length + 1}>
                  No rows match.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <footer className="pagination">
        <span>
          {total === 0
            ? "0 rows"
            : `${String(from)}–${String(to)} of ${String(total)}`}
        </span>
        <span className="spacer" />
        <label>
          Page size{" "}
          <select
            value={query.limit}
            onChange={(event) => {
              setQuery((current) => ({
                ...current,
                offset: 0,
                limit: Number(event.target.value),
              }));
            }}
          >
            {[25, 50, 100, 200].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <button
          disabled={query.offset === 0}
          onClick={() => {
            setQuery((current) => ({
              ...current,
              offset: Math.max(0, current.offset - current.limit),
            }));
          }}
        >
          ← Prev
        </button>
        <button
          disabled={to >= total}
          onClick={() => {
            setQuery((current) => ({
              ...current,
              offset: current.offset + current.limit,
            }));
          }}
        >
          Next →
        </button>
      </footer>
    </section>
  );
}
