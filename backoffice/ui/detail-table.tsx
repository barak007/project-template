import type { ReactNode } from "react";

/**
 * One section table on a detail page: fixed headers, one row per record,
 * and an empty-state row when there are none.
 */
export function DetailTable<Row>({
  columns,
  rows,
  rowKey,
  cells,
  emptyMessage,
}: {
  /** Header labels; an empty string renders a blank header cell. */
  columns: string[];
  rows: Row[];
  rowKey: (row: Row) => string;
  cells: (row: Row) => ReactNode[];
  emptyMessage: string;
}) {
  return (
    <table>
      <thead>
        <tr>
          {columns.map((column, index) => (
            <th key={index}>{column === "" ? null : column}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={rowKey(row)}>
            {cells(row).map((cell, index) => (
              <td key={index}>{cell}</td>
            ))}
          </tr>
        ))}
        {rows.length === 0 ? (
          <tr>
            <td className="empty" colSpan={columns.length}>
              {emptyMessage}
            </td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}
