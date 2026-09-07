import type { UserDetail } from "../client/index.js";

type WorkSessionStatus = UserDetail["workSessions"][number]["status"];

/**
 * A work session's status as one glance, mirroring the app's status pill:
 * "materialize" is internal vocabulary — an operator sees a session being
 * prepared — and the tone class stays within the ones the stylesheet defines.
 */
export function StatusPill({ status }: { status: WorkSessionStatus }) {
  const { tone, label } = presentation(status);
  return <span className={`status status-${tone}`}>{label}</span>;
}

function presentation(status: WorkSessionStatus): {
  tone: string;
  label: string;
} {
  switch (status) {
    case "pending":
    case "materializing":
      return { tone: "waiting", label: "Preparing" };
    case "ready":
      return { tone: "ready", label: "Ready" };
    case "failed":
      return { tone: "failed", label: "Failed" };
  }
}
