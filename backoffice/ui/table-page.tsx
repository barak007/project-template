import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import {
  ApiError,
  defaultTableQuery,
  FILTER_SYNTAX_HINT,
  referencesTo,
  textRowFilter,
} from "../client/index.js";
import type {
  BackofficeCore,
  ColumnMeta,
  RowFilter,
  TableQuery,
  TableRow,
} from "../client/index.js";

import { DateRangeFilter } from "./date-range-filter.js";
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
      case "string": {
        if (column.enumValues) {
          filters.push({ column: column.key, op: "eq", value: draft });
          break;
        }
        const filter = textRowFilter(column.key, draft);
        if (filter) filters.push(filter);
        break;
      }
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

export function TablePage({
  core,
  load,
  table,
  routeFilters,
  routeLimit,
  routeOffset,
  heading,
  insertControl,
  rowActions,
  deleteConfirm,
  deleteAction,
}: {
  core: BackofficeCore;
  load: (action: () => Promise<void>) => Promise<void>;
  table: string;
  /** Filters carried by the route (e.g. a followed foreign-key link). */
  routeFilters?: RowFilter[] | undefined;
  /** Pagination carried by the route so reloads keep their page. */
  routeLimit?: number | undefined;
  routeOffset?: number | undefined;
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

  // Pagination rides a ref so the reset effect keys on table/filter changes
  // alone — the URL mirror below rewrites the route on every page turn, and
  // that must not wipe drafts or reset the query it just came from.
  const routePage = useRef({ limit: routeLimit, offset: routeOffset });
  routePage.current = { limit: routeLimit, offset: routeOffset };
  const queryFromRoute = (filters: RowFilter[]): TableQuery => ({
    ...defaultTableQuery,
    ...(routePage.current.limit === undefined
      ? {}
      : { limit: routePage.current.limit }),
    ...(routePage.current.offset === undefined
      ? {}
      : { offset: routePage.current.offset }),
    filters,
  });

  const [query, setQuery] = useState<TableQuery>(() =>
    queryFromRoute(routeFilters ?? []),
  );
  const [drafts, setDrafts] = useState<Drafts>({});
  const [editor, setEditor] = useState<Editor | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Serialized so the effect keys on filter content, not array identity.
  const routeFiltersKey = JSON.stringify(routeFilters ?? []);
  const skipApply = useRef(true);
  const skipReset = useRef(true);
  useEffect(() => {
    // The lazy useState above already holds the boot route's query.
    if (skipReset.current) {
      skipReset.current = false;
      return;
    }
    skipApply.current = true;
    setQuery(queryFromRoute(JSON.parse(routeFiltersKey) as RowFilter[]));
    setDrafts({});
    setEditor(null);
    setError(null);
  }, [table, routeFiltersKey]);

  // The URL mirrors pagination so a reload or shared link lands on the same
  // page. Replace, not push — turning a page is state, not a navigation step.
  useEffect(() => {
    const filters = JSON.parse(routeFiltersKey) as RowFilter[];
    core.navigation.replace({
      kind: "table",
      table,
      ...(filters.length > 0 ? { filters } : {}),
      limit: query.limit,
      offset: query.offset,
    });
  }, [core, table, routeFiltersKey, query.limit, query.offset]);

  // Filters apply automatically, debounced, whenever a draft changes. The
  // skip flag keeps the reset above (empty drafts) from wiping route filters.
  // Columns go through a ref so the effect keys on draft edits alone.
  const columnsRef = useRef<ColumnMeta[]>([]);
  columnsRef.current = meta?.columns ?? [];
  useEffect(() => {
    if (skipApply.current) {
      skipApply.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setQuery((current) => ({
        ...current,
        offset: 0,
        filters: buildFilters(columnsRef.current, drafts),
      }));
    }, 300);
    return () => {
      clearTimeout(timer);
    };
  }, [drafts]);

  useEffect(() => {
    void load(() => core.data.loadRows(table, query));
  }, [core, load, table, query]);

  if (!meta) return <p>Loading…</p>;
  const columns = meta.columns;
  const page = tableData?.table === table ? tableData.page : null;

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

  const clearFilters = () => {
    setDrafts({});
    setQuery((current) => ({ ...current, offset: 0, filters: [] }));
    if (routeFilters && routeFilters.length > 0)
      core.navigation.navigate({ kind: "table", table });
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
      <details className="row-refs">
        <summary>refs</summary>
        {incoming.map((reference) => (
          <button
            key={`${reference.table}.${reference.column}`}
            title={
              reference.onDelete === "restrict"
                ? "Existing rows here block deletion (on delete restrict)"
                : undefined
            }
            onClick={() => {
              follow(reference.table, reference.column, keyValue);
            }}
          >
            {reference.table}.{reference.column}
            {reference.onDelete === "restrict" ? " ⛔" : ""}
          </button>
        ))}
      </details>
    );
  };

  const sortMarker = (column: ColumnMeta) =>
    query.sort === column.key ? (query.dir === "asc" ? " ▲" : " ▼") : "";

  const filterControl = (column: ColumnMeta) => {
    if (column.redacted || column.dataType === "json") return null;
    if (column.dataType === "date")
      return (
        <DateRangeFilter
          from={drafts[`${column.key}:from`] ?? ""}
          to={drafts[`${column.key}:to`] ?? ""}
          onChange={(bound, value) => {
            setDraft(`${column.key}:${bound}`, value);
          }}
        />
      );
    if (column.enumValues || column.dataType === "boolean")
      return (
        <select
          value={drafts[column.key] ?? ""}
          onChange={(event) => {
            setDraft(column.key, event.target.value);
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
        value={drafts[column.key] ?? ""}
        onChange={(event) => {
          setDraft(column.key, event.target.value);
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
        <h1>{heading ?? table}</h1>
        <span className="spacer" />
        <button
          onClick={() => {
            setEditor({ mode: "insert" });
          }}
        >
          {insertControl?.label ?? "Add row"}
        </button>
      </header>

      {error ? <p className="error">{error}</p> : null}

      {query.filters.length > 0 ? (
        <p className="active-filters">
          Filtered:{" "}
          {query.filters
            .map(
              (filter) =>
                `${filter.column} ${filter.op}${
                  filter.value === undefined || filter.value === null
                    ? ""
                    : ` ${typeof filter.value === "object" ? JSON.stringify(filter.value) : String(filter.value)}`
                }`,
            )
            .join(", ")}{" "}
          <button onClick={clearFilters}>Clear</button>
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
                      toggleSort(column);
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
