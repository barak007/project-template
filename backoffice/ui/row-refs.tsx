import { createPortal } from "react-dom";

import type { IncomingReference } from "../client/index.js";

import { useAnchoredPanel } from "./use-anchored-panel.js";

/** Approximate panel width used to keep it inside the viewport. */
const PANEL_WIDTH = 240;

/**
 * The "referenced by" menu for a row: every table whose foreign keys point at
 * it. The panel renders in a portal with fixed positioning so the table's
 * scroll container cannot clip it.
 */
export function RowRefs({
  references,
  onSelect,
}: {
  references: IncomingReference[];
  onSelect: (reference: IncomingReference) => void;
}) {
  const { open, setOpen, position, anchorRef, panelRef } =
    useAnchoredPanel(PANEL_WIDTH);

  return (
    <>
      <button
        ref={anchorRef}
        className="row-refs"
        title="Tables referencing this row"
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        refs
      </button>
      {open
        ? createPortal(
            <div
              ref={panelRef}
              className="row-refs-list"
              style={{ top: position.top, left: position.left }}
            >
              {references.map((reference) => (
                <button
                  key={`${reference.table}.${reference.column}`}
                  title={
                    reference.onDelete === "restrict"
                      ? "Existing rows here block deletion (on delete restrict)"
                      : undefined
                  }
                  onClick={() => {
                    setOpen(false);
                    onSelect(reference);
                  }}
                >
                  {reference.table}.{reference.column}
                  {reference.onDelete === "restrict" ? " ⛔" : ""}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
