import type { AppCore, WorkSession } from "../client/index.js";

import { EntityIcon } from "./entity-icon.js";
import { locationOf } from "./project-location.js";
import { RouteLink } from "./route-link.js";
import { StatusPill } from "./status-pill.js";

/**
 * One session in a workspace's list. A session is named by the branch it holds
 * and when it started, not by its status: three ready sessions all titled "Ready"
 * are three rows a user cannot tell apart.
 */
export function SessionCard({
  core,
  session,
  organizationId,
  workspaceId,
}: {
  core: AppCore;
  session: WorkSession;
  organizationId: string;
  workspaceId: string;
}) {
  const preparing =
    session.status === "pending" || session.status === "materializing";

  return (
    <article className="session">
      <div className="session-head">
        <span className="session-name">
          <EntityIcon entity="session" />
          {session.projectBranch ?? shortId(session.id)}
        </span>
        <StatusPill status={session.status} />
        <span className="muted">{detail(session)}</span>
        {session.status === "ready" && (
          <RouteLink
            core={core}
            to={{
              kind: "session",
              organizationId,
              workspaceId,
              workSessionId: session.id,
            }}
            className="button small"
          >
            Open
          </RouteLink>
        )}
      </div>

      {/* What it is doing right now, which is the whole point of a progress
          trail: "Preparing…" on its own tells a user nothing. Open while that is
          still true, closed once the session is history. */}
      {session.progress.length > 0 && (
        <details open={preparing}>
          <summary className="log-toggle">
            {session.progress.length} step
            {session.progress.length === 1 ? "" : "s"}
          </summary>
          <ol className="log">
            {session.progress.map((entry, index) => (
              <li key={`${entry.at}-${String(index)}`}>
                <code>{time(entry.at)}</code> {entry.step}
                {entry.detail !== undefined && (
                  <span className="muted"> {entry.detail}</span>
                )}
              </li>
            ))}
          </ol>
        </details>
      )}
    </article>
  );
}

/**
 * The one line worth reading beside the status: where the project is once there
 * is one, why it failed if it did, and what the worker is doing until then.
 */
function detail(session: WorkSession): string {
  if (session.status === "ready")
    return session.projectLocation === null
      ? (session.failureCode ?? "")
      : locationOf(session.projectLocation);
  const last = session.progress.at(-1);
  if (session.status === "failed")
    return last?.detail ?? session.failureCode ?? "";
  return last?.step ?? "Waiting for a worker…";
}

/** Enough of the id to tell two sessions apart, for one with no branch yet. */
function shortId(id: string): string {
  return id.slice(0, 8);
}

/** Wall-clock time only: the date is the session's own `createdAt`. */
function time(at: string): string {
  return at.slice(11, 19);
}
