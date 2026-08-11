import type { AppCore } from "../client/index.js";

import { useAppState } from "./use-app-state.js";

/**
 * The last failed action, as the store recorded it — on a surface of its own, so
 * a failure is not a red sentence that slides the page down and is scrolled past.
 *
 * `role="alert"` because the user's attention is elsewhere: they pressed a button
 * and are waiting, and a screen reader would otherwise say nothing at all.
 */
export function ErrorBanner({ core }: { core: AppCore }) {
  const error = useAppState(core, (state) => state.error);
  if (!error) return null;
  return (
    <div className="banner" role="alert">
      <strong aria-hidden="true">!</strong>
      <p>{error.message}</p>
      <button
        type="button"
        className="banner-dismiss"
        aria-label="Dismiss"
        onClick={() => {
          core.notices.dismiss();
        }}
      >
        ×
      </button>
    </div>
  );
}
