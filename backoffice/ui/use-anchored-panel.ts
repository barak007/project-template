import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * A popover anchored under a button. The caller renders the panel through a
 * portal with these fixed coordinates so the table's scroll container — which
 * clips anything absolutely positioned inside it — cannot cut the panel off.
 *
 * Closes on an outside press or Escape.
 *
 * @param width Approximate panel width, used to keep it inside the viewport.
 */
export function useAnchoredPanel(width: number) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({
      top: rect.bottom + 4,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width)),
    });
  }, [open, width]);

  useEffect(() => {
    if (!open) return;
    const onPress = (event: MouseEvent) => {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target)) return;
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

  return { open, setOpen, position, anchorRef, panelRef };
}
