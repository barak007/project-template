import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { ApiError, FILTER_SYNTAX_HINT, referencesTo } from "../client/index.js";
import type { BackofficeCore, ColumnMeta, TableRow } from "../client/index.js";

import { DateRangeFilter } from "./date-range-filter.js";
import { RowEditor } from "./row-editor.js";
import { RowRefs } from "./row-refs.js";
import { useBackofficeState } from "./use-backoffice-state.js";

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

/** A row value as plain text — ids and names, not jsonb payloads. */
export function rowText(value: TableRow[string] | undefined): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}

function rowKey(primaryKey: string[], row: TableRow): TableRow {
  return Object.fromEntries(
    primaryKey.map((column) => [column, row[column] ?? null]),
  );
}

type Editor = { mode: "insert" } | { mode: "edit"; row: TableRow };

/**
 * The generic table console. The view it renders — query, filter drafts, and
 * the filters the route arrived with — lives in the store as `tableView`
 * (backoffice/client/table-view.ts), reset by navigation when another table
 * opens; callers key this component on table + route filters so the local
 * editor/error state resets with it.
 */
export function TablePage({
  core,
  load,
  table,
  heading,
  insertControl,
  rowActions,
  deleteConfirm,
  deleteAction,
}: {
  core: BackofficeCore;
  load: (action: () => Promise<void>) => Promise<void>;
  table: string;
  /** Page title when the raw table name is not it (e.g. "Users"). */
  heading?: string | undefined;
  /** Replaces the generic insert editor when creation has side effects. */
  insertControl?:
    { label: string; editor: (close: () => void) => ReactNode } | undefined;
  /** Extra per-row actions, rendered before Edit/Delete. */
  rowActions?: ((row: TableRow) => ReactNode) | undefined;
  /** Custom delete confirmation message. */
  deleteConfirm?: ((row: TableRow) => string) | undefined;
  /** Replaces the generic row delete when deletion has side effects. */
  deleteAction?: ((row: TableRow) => Promise<void>) | undefined;
}) {
  const meta = useBackofficeState(core, (state) =>
    state.tables.find((entry) => entry.name === table),
  );
  const tables = useBackofficeState(core, (state) => state.tables);
  const tableData = useBackofficeState(core, (state) => state.tableData);
  const tableView = useBackofficeState(core, (state) => state.tableView);
  const view = tableView?.table === table ? tableView : null;

  // Editor and error are still component state (their extraction is the next
  // slice); everything else the page shows comes from the store.
  const [editor, setEditor] = useState<Editor | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = view?.query ?? null;
  useEffect(() => {
    if (!query) return;
    void load(() => core.data.loadRows(table, query));
  }, [core, load, table, query]);

  // Filters apply automatically, debounced, whenever a draft changes. Only
  // the timing lives here: applyFilters ignores untouched drafts, so the
  // debounce firing after a view reset can never wipe route filters.
  const drafts = view?.drafts ?? null;
  useEffect(() => {
    if (!drafts || Object.keys(drafts).length === 0) return;
    const timer = setTimeout(() => {
      core.view.applyFilters();
    }, 300);
    return () => {
      clearTimeout(timer);
    };
  }, [core, drafts]);

  if (!meta || !view) return <p>Loading…</p>;
  const columns = meta.columns;
  const page = tableData?.table === table ? tableData.page : null;

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
    const message =
      deleteConfirm?.(row) ?? "Delete this row? This cannot be undone.";
    if (!window.confirm(message)) return;
    void run(() =>
      deleteAction
        ? deleteAction(row)
        : core.data.deleteRow(table, rowKey(meta.primaryKey, row)),
    );
  };

  /** Jump to another table filtered to the rows a value points at. */
  const follow = (target: string, column: string, value: string | number) => {
    core.navigation.navigate({
      kind: "table",
      table: target,
      filters: [{ column, op: "eq", value }],
    });
  };

  // Tables whose foreign keys point here — each row links to its dependents.
  const incoming =
    meta.primaryKey.length === 1 ? referencesTo(tables, table) : [];
  const rowReferences = (row: TableRow) => {
    const keyValue = row[meta.primaryKey[0] ?? ""];
    if (typeof keyValue !== "string" && typeof keyValue !== "number")
      return null;
    if (incoming.length === 0) return null;
    return (
      <RowRefs
        references={incoming}
        onSelect={(reference) => {
          follow(reference.table, reference.column, keyValue);
        }}
      />
    );
  };

  const sortMarker = (column: ColumnMeta) =>
    view.query.sort === column.key
      ? view.query.dir === "asc"
        ? " ▲"
        : " ▼"
      : "";

  const filterControl = (column: ColumnMeta) => {
    if (column.redacted || column.dataType === "json") return null;
    if (column.dataType === "date")
      return (
        <DateRangeFilter
          from={view.drafts[`${column.key}:from`] ?? ""}
          to={view.drafts[`${column.key}:to`] ?? ""}
          onChange={(bound, value) => {
            core.view.setDraft(`${column.key}:${bound}`, value);
          }}
        />
      );
    if (column.enumValues || column.dataType === "boolean")
      return (
        <select
          value={view.drafts[column.key] ?? ""}
          onChange={(event) => {
            core.view.setDraft(column.key, event.target.value);
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
        title={FILTER_SYNTAX_HINT}
        value={view.drafts[column.key] ?? ""}
        onChange={(event) => {
          core.view.setDraft(column.key, event.target.value);
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
        <h1 className={heading ? "" : "raw"}>{heading ?? table}</h1>
        <span className="spacer" />
        <button
          className="primary"
          onClick={() => {
            setEditor({ mode: "insert" });
          }}
        >
          {insertControl?.label ?? "Add row"}
        </button>
      </header>

      {error ? <p className="error">{error}</p> : null}

      {view.query.filters.length > 0 ? (
        <p className="active-filters">
          Filtered:{" "}
          {view.query.filters
            .map(
              (filter) =>
                `${filter.column} ${filter.op}${
                  filter.value === undefined || filter.value === null
                    ? ""
                    : ` ${typeof filter.value === "object" ? JSON.stringify(filter.value) : String(filter.value)}`
                }`,
            )
            .join(", ")}{" "}
          <button
            onClick={() => {
              core.view.clearFilters();
            }}
          >
            Clear
          </button>
        </p>
      ) : null}

      {editor?.mode === "insert" && insertControl ? (
        insertControl.editor(() => {
          setEditor(null);
        })
      ) : editor ? (
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
        {/* Width floor per column: with fixed layout, wide tables scroll
            inside the wrapper instead of squeezing columns to slivers. */}
        <table style={{ minWidth: `${String(columns.length * 8 + 11)}rem` }}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={column.redacted ? "" : "sortable"}
                >
                  {/* Sort on the label, not the cell, so dragging the
                      resize handle never toggles the sort. */}
                  <span
                    className="sort-label"
                    onClick={() => {
                      core.view.toggleSort(column.key);
                    }}
                  >
                    {column.key}
                    {sortMarker(column)}
                  </span>
                </th>
              ))}
              <th className="actions" />
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
                {columns.map((column) => {
                  const value = row[column.key];
                  const reference = column.references;
                  return (
                    <td
                      key={column.key}
                      className={column.redacted ? "redacted" : ""}
                      title={formatCell(column, value)}
                    >
                      {formatCell(column, value)}
                      {reference &&
                      (typeof value === "string" ||
                        typeof value === "number") ? (
                        <button
                          className="fk-link"
                          title={`Open ${reference.table} where ${reference.column} = ${String(value)}`}
                          onClick={() => {
                            follow(reference.table, reference.column, value);
                          }}
                        >
                          ↗
                        </button>
                      ) : null}
                    </td>
                  );
                })}
                <td className="row-actions">
                  {rowActions?.(row)}
                  {rowReferences(row)}
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
            value={view.query.limit}
            onChange={(event) => {
              core.view.setLimit(Number(event.target.value));
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
          disabled={view.query.offset === 0}
          onClick={() => {
            core.view.previousPage();
          }}
        >
          ← Prev
        </button>
        <button
          disabled={to >= total}
          onClick={() => {
            core.view.nextPage();
          }}
        >
          Next →
        </button>
      </footer>
    </section>
  );
}
