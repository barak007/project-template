import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({
      top: rect.bottom + 4,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - PANEL_WIDTH)),
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPress = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPress);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPress);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Dates only in the label — the panel holds the full timestamps.
  const day = (value: string) => value.slice(0, 10);
  const label =
    from || to ? `${from ? day(from) : "…"} → ${to ? day(to) : "…"}` : "any";

  return (
    <>
      <button
        ref={buttonRef}
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
