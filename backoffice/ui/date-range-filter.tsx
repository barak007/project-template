import { createPortal } from "react-dom";

import { useAnchoredPanel } from "./use-anchored-panel.js";

/** Approximate panel width used to keep it inside the viewport. */
const PANEL_WIDTH = 260;

/**
 * Compact date-range filter: a one-line button showing the active range,
 * expanding to from/to inputs. The panel renders in a portal with fixed
 * positioning so the table's scroll container cannot clip it.
 */
export function DateRangeFilter({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (bound: "from" | "to", value: string) => void;
}) {
  const { open, setOpen, position, anchorRef, panelRef } =
    useAnchoredPanel(PANEL_WIDTH);

  // Dates only in the label — the panel holds the full timestamps.
  const day = (value: string) => value.slice(0, 10);
  const label =
    from || to ? `${from ? day(from) : "…"} → ${to ? day(to) : "…"}` : "any";

  return (
    <>
      <button
        ref={anchorRef}
        className="date-range"
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        {label}
      </button>
      {open
        ? createPortal(
            <div
              ref={panelRef}
              className="date-range-panel"
              style={{ top: position.top, left: position.left }}
            >
              <label>
                from
                <input
                  type="datetime-local"
                  value={from}
                  onChange={(event) => {
                    onChange("from", event.target.value);
                  }}
                />
              </label>
              <label>
                to
                <input
                  type="datetime-local"
                  value={to}
                  onChange={(event) => {
                    onChange("to", event.target.value);
                  }}
                />
              </label>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
