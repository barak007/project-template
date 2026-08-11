import type { WorkSession } from "../client/index.js";

/**
 * A session's status as one glance. Four sessions in a list are scanned, not
 * read: a colour and a dot separate three ready ones from the failed one before
 * any word is.
 *
 * "Materialize" is internal; a user sees a session being prepared.
 */
export function StatusPill({ status }: { status: WorkSession["status"] }) {
  const { tone, label } = presentation(status);
  return <span className={`status status-${tone}`}>{label}</span>;
}

function presentation(status: WorkSession["status"]): {
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
