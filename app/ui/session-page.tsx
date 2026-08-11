import { useEffect } from "react";

import {
  currentOrganization,
  currentWorkSession,
  currentWorkspace,
} from "../client/index.js";
import type { AppCore, WorkSession } from "../client/index.js";

import { EntityIcon } from "./entity-icon.js";
import { ErrorBanner } from "./error-banner.js";
import { RouteLink } from "./route-link.js";
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
  workspaceId,
  workSessionId,
}: {
  core: AppCore;
  organizationId: string;
  workspaceId: string;
  workSessionId: string;
}) {
  const organization = useAppState(core, currentOrganization);
  const workspace = useAppState(core, currentWorkspace);
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
    <section className="page">
      <header className="page-header">
        <RouteLink
          core={core}
          to={{ kind: "workspace", organizationId, workspaceId }}
          className="link entity-chip"
        >
          <EntityIcon entity="workspace" />←{" "}
          {workspace?.name ?? organization?.name ?? "Workspace"}
        </RouteLink>
        <h1 className="entity-chip">
          <EntityIcon entity="session" />
          Session
        </h1>
        <p className="muted">
          {session === undefined
            ? "Loading…"
            : `${statusLabel(session)}${
                session.projectBranch === null
                  ? ""
                  : ` · ${session.projectBranch}`
              }`}
        </p>
      </header>
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
        <p className="empty">
          {session === undefined
            ? "Loading…"
            : preparing
              ? "This session is still being prepared."
              : (session.failureCode ?? "This session has no project to open.")}
        </p>
      )}
    </section>
  );
}

/** "Materialize" is internal; a user sees a session being prepared. */
function statusLabel(session: WorkSession): string {
  switch (session.status) {
    case "pending":
    case "materializing":
      return "Preparing…";
    case "ready":
      return "Ready";
    case "failed":
      return "Failed";
  }
}
