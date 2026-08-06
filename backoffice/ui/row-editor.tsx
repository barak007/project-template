import { useState } from "react";

import type { ColumnMeta, TableMeta, TableRow } from "../client/index.js";

type RowValues = TableRow;

/** Field drafts are strings straight from the inputs; JSON fields hold JSON text. */
function initialDrafts(meta: TableMeta, row: TableRow | null) {
  return Object.fromEntries(
    meta.columns.map((column) => {
      const value = row?.[column.key];
      if (value === null || value === undefined) return [column.key, ""];
      if (column.dataType === "json" || typeof value === "object")
        return [column.key, JSON.stringify(value, null, 2)];
      return [column.key, String(value)];
    }),
  );
}

function parseDraft(column: ColumnMeta, draft: string): RowValues[string] {
  switch (column.dataType) {
    case "number": {
      const value = Number(draft);
      if (Number.isNaN(value)) throw new Error(`${column.key} is not a number`);
      return value;
    }
    case "boolean":
      return draft === "true";
    case "json":
      try {
        return JSON.parse(draft) as RowValues[string];
      } catch {
        throw new Error(`${column.key} is not valid JSON`);
      }
    case "date":
    case "string":
      return draft;
  }
}

export function RowEditor({
  meta,
  row,
  onSave,
  onCancel,
}: {
  meta: TableMeta;
  /** null means insert mode. */
  row: TableRow | null;
  onSave: (values: RowValues) => Promise<void>;
  onCancel: () => void;
}) {
  const editing = row !== null;
  const [drafts, setDrafts] = useState(() => initialDrafts(meta, row));
  const [initial] = useState(drafts);
  const [error, setError] = useState<string | null>(null);

  const editable = (column: ColumnMeta) =>
    !column.redacted && !(editing && column.primaryKey);

  const submit = () => {
    const values: RowValues = {};
    try {
      for (const column of meta.columns) {
        if (!editable(column)) continue;
        const draft = drafts[column.key] ?? "";
        // Untouched fields are omitted: inserts fall back to column defaults,
        // updates leave the column unchanged.
        if (editing ? draft === initial[column.key] : draft === "") continue;
        values[column.key] = parseDraft(column, draft);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Invalid value");
      return;
    }
    if (Object.keys(values).length === 0) {
      onCancel();
      return;
    }
    setError(null);
    void onSave(values);
  };

  const field = (column: ColumnMeta) => {
    const draft = drafts[column.key] ?? "";
    const set = (value: string) => {
      setDrafts((current) => ({ ...current, [column.key]: value }));
    };
    if (!editable(column))
      return <input value={editing ? draft : ""} disabled />;
    if (column.enumValues || column.dataType === "boolean")
      return (
        <select
          value={draft}
          onChange={(event) => {
            set(event.target.value);
          }}
        >
          <option value="">{editing ? "(unchanged)" : "(default)"}</option>
          {(column.enumValues ?? ["true", "false"]).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      );
    if (column.dataType === "json")
      return (
        <textarea
          rows={3}
          value={draft}
          placeholder="JSON"
          onChange={(event) => {
            set(event.target.value);
          }}
        />
      );
    return (
      <input
        value={draft}
        placeholder={column.dataType === "date" ? "ISO timestamp" : ""}
        onChange={(event) => {
          set(event.target.value);
        }}
      />
    );
  };

  return (
    <div className="row-editor">
      <h2>{editing ? "Edit row" : "Add row"}</h2>
      {error ? <p className="error">{error}</p> : null}
      <div className="fields">
        {meta.columns.map((column) => (
          <label key={column.key}>
            <span>
              {column.key}
              {column.notNull && !column.hasDefault ? " *" : ""}
              {column.primaryKey ? " (key)" : ""}
              {column.redacted ? " (redacted)" : ""}
            </span>
            {field(column)}
          </label>
        ))}
      </div>
      <div className="editor-actions">
        <button className="primary" onClick={submit}>
          Save
        </button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
