import { isConfirming, isPending } from "../client/index.js";
import type { AppCore } from "../client/index.js";

import { useAppState } from "./use-app-state.js";

/**
 * A destructive action as two presses in the same place. The first arms the row
 * and the second commits, so nothing irreversible happens on one stray click —
 * and no dialog has to be read and dismissed to change your mind.
 *
 * Both the armed row and the in-flight action live in the store (`confirming`,
 * `pending`), so which row is armed is one fact for the whole page: arming a
 * second row disarms the first.
 */
export function ConfirmButton({
  core,
  confirmKey,
  actionKey,
  label,
  question,
  onConfirm,
}: {
  core: AppCore;
  /** What is armed. One at a time across the page. */
  confirmKey: string;
  /** What is in flight, once committed. */
  actionKey: string;
  label: string;
  /** What the row asks once armed — name the thing, not the verb. */
  question: string;
  onConfirm: () => void;
}) {
  const armed = useAppState(core, (state) => isConfirming(state, confirmKey));
  const pending = useAppState(core, (state) => isPending(state, actionKey));

  if (pending)
    return (
      <button type="button" className="ghost danger small" disabled aria-busy>
        Working…
      </button>
    );

  if (!armed)
    return (
      <button
        type="button"
        className="ghost danger small"
        onClick={() => {
          core.confirmation.ask(confirmKey);
        }}
      >
        {label}
      </button>
    );

  return (
    <span className="confirm">
      {question}
      <button type="button" className="ghost danger small" onClick={onConfirm}>
        {label}
      </button>
      <button
        type="button"
        className="ghost small"
        // The way out is the one with focus, so Enter on an armed row cancels.
        autoFocus
        onClick={() => {
          core.confirmation.cancel();
        }}
      >
        Cancel
      </button>
    </span>
  );
}
