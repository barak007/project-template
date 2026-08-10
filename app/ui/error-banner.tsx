import type { AppCore } from "../client/index.js";

import { useAppState } from "./use-app-state.js";

/** The last failed action, as the store recorded it. */
export function ErrorBanner({ core }: { core: AppCore }) {
  const error = useAppState(core, (state) => state.error);
  if (!error) return null;
  return <p className="error">{error.message}</p>;
}
