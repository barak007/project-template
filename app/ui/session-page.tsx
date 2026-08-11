import { useEffect } from "react";

import { currentWorkSession } from "../client/index.js";
import type { AppCore, WorkSession } from "../client/index.js";

import { ErrorBanner } from "./error-banner.js";
import { PageHeader } from "./page-header.js";
import { StatusPill } from "./status-pill.js";
import { useAppState } from "./use-app-state.js";
import { Workbench } from "./workbench.js";

/**
 * One session, as an editor over the clone it holds. The session's own copy —
 * editing here would not touch the workspace's project, which is what
 * [the project page](./workspace-project-page.tsx) shows.
 */
export function SessionPage({
  core,
  organizationId,
  workSessionId,
}: {
  core: AppCore;
  organizationId: string;
  /** The workspace is in the route already — the breadcrumb reads it there. */
  workSessionId: string;
}) {
  const session = useAppState(core, currentWorkSession);

  useEffect(() => {
    void core.organizations.load();
    void core.workspaces.load(organizationId);
    void core.workSessions.load(organizationId);
  }, [core, organizationId]);

  const preparing =
    session?.status === "pending" || session?.status === "materializing";

  // A session being prepared is finished by a worker, so the page has to ask.
  useEffect(() => {
    if (!preparing) return;
    const timer = setInterval(() => {
      void core.workSessions.refreshPending(organizationId);
    }, 1500);
    return () => clearInterval(timer);
  }, [core, organizationId, preparing]);

  return (
    <section className="page fills">
      <PageHeader
        core={core}
        entity="session"
        title={session?.projectBranch ?? "Session"}
        lead={
          session === undefined ? (
            "Loading…"
          ) : (
            <span className="entity-chip">
              <StatusPill status={session.status} />
              {message(session)}
            </span>
          )
        }
      />
      <ErrorBanner core={core} />

      {/* Only a ready session has a project, and until the list has loaded we do
          not know which this is — reading either way would flash an error. */}
      {session?.status === "ready" ? (
        <Workbench
          core={core}
          organizationId={organizationId}
          target={{ kind: "session", id: workSessionId }}
        />
      ) : (
        <div className="empty">
          <p>
            {session === undefined
              ? "Loading…"
              : preparing
                ? "This session is still being prepared."
                : (session.failureCode ??
                  "This session has no project to open.")}
          </p>
        </div>
      )}
    </section>
  );
}

/** What the status does not already say. */
function message(session: WorkSession): string {
  if (session.status === "failed") return session.failureCode ?? "";
  return session.progress.at(-1)?.step ?? "";
}
