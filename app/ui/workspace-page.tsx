import { useEffect } from "react";

import { currentOrganization, currentWorkspace } from "../client/index.js";
import type { AppCore, WorkSession } from "../client/index.js";

import { EntityIcon } from "./entity-icon.js";
import { ErrorBanner } from "./error-banner.js";
import { locationOf } from "./project-location.js";
import { RouteLink } from "./route-link.js";
import { useAppState } from "./use-app-state.js";

/**
 * One workspace: the repositories it works on, and the sessions opened from
 * them. Adding a repository is typing its URL — nothing has to be connected
 * first, and nothing has to already exist on this machine.
 */
export function WorkspacePage({
  core,
  organizationId,
  workspaceId,
}: {
  core: AppCore;
  organizationId: string;
  workspaceId: string;
}) {
  const organization = useAppState(core, currentOrganization);
  const workspace = useAppState(core, currentWorkspace);
  const sources = useAppState(core, (state) => state.sources);
  const workSessions = useAppState(core, (state) => state.workSessions);
  const draft = useAppState(core, (state) => state.repositoryDraft);

  useEffect(() => {
    void core.organizations.load();
    void core.workspaces.load(organizationId);
    void core.repositories.load(organizationId);
    void core.workSessions.load(organizationId);
  }, [core, organizationId]);

  // Derived during render, never in a selector: a filter builds a fresh array
  // every call, which useSyncExternalStore reads as a changed snapshot.
  const attached = sources.filter((source) =>
    workspace?.sourceIds.includes(source.id),
  );
  const sessions = workSessions.filter(
    (session) => session.workspaceId === workspaceId,
  );
  const preparing = sessions.some(
    (session) =>
      session.status === "pending" || session.status === "materializing",
  );

  // A session that is being prepared is finished by a worker, so the page has
  // to ask; polling stops as soon as none are left.
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
          to={{ kind: "organization", organizationId }}
          className="link entity-chip"
        >
          <EntityIcon entity="organization" />←{" "}
          {organization?.name ?? "Organization"}
        </RouteLink>
        <h1 className="entity-chip">
          <EntityIcon entity="workspace" />
          {workspace?.name ?? "Workspace"}
        </h1>
        <p className="muted">
          A session clones these repositories into one project.
        </p>
      </header>
      <ErrorBanner core={core} />

      <h2>Project</h2>
      {/* The workspace owns one git project — the template each session clones.
          It is built by the first session, so before that there is nothing to
          open, and the link says so rather than leading to an error. */}
      <div className="project-row">
        <EntityIcon entity="project" />
        {workspace?.projectLocation ? (
          <>
            <RouteLink
              core={core}
              to={{ kind: "workspace-project", organizationId, workspaceId }}
              className="link"
            >
              Browse the workspace project
            </RouteLink>
            <code>{locationOf(workspace.projectLocation)}</code>
          </>
        ) : (
          <span className="muted">
            Built by this workspace&apos;s first session.
          </span>
        )}
      </div>

      <h2>Repositories</h2>
      <form
        className="inline-form"
        onSubmit={(submit) => {
          submit.preventDefault();
          void core.repositories.add(organizationId, workspaceId);
        }}
      >
        <input
          aria-label="Repository URL"
          placeholder="https://github.com/owner/repository.git"
          value={draft}
          onChange={(change) => {
            core.repositories.draft(change.target.value);
          }}
        />
        <button type="submit" disabled={draft.trim().length === 0}>
          Add
        </button>
      </form>
      {attached.length === 0 ? (
        <p className="empty">No repositories in this workspace yet.</p>
      ) : (
        <ul className="rows">
          {attached.map((source) => (
            <li key={source.id}>
              <strong className="entity-chip">
                <EntityIcon entity="repository" />
                {source.name}
              </strong>
              <span className="muted">{remoteOf(source.config)}</span>
              <button
                className="ghost danger"
                onClick={() => {
                  void core.repositories.remove(
                    organizationId,
                    workspaceId,
                    source.id,
                  );
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <h2>Sessions</h2>
      <button
        disabled={attached.length === 0}
        onClick={() => {
          void core.workSessions.create(organizationId, workspaceId);
        }}
      >
        Create session
      </button>
      {attached.length === 0 && (
        <p className="muted">Add a repository first — a session opens these.</p>
      )}
      {sessions.map((session) => (
        <article key={session.id} className="session">
          <header>
            {/* The session's own page is the editor over its files; a session
                still being prepared has nothing to open yet. */}
            <strong className="entity-chip">
              <EntityIcon entity="session" />
              {statusLabel(session)}
            </strong>
            {session.status === "ready" && (
              <RouteLink
                core={core}
                to={{
                  kind: "session",
                  organizationId,
                  workspaceId,
                  workSessionId: session.id,
                }}
                className="link"
              >
                Open
              </RouteLink>
            )}
            {/* What it is doing right now, which is the whole point of a
                progress trail: "Preparing…" on its own tells a user nothing. */}
            <span className="muted">{currentStep(session)}</span>
          </header>
          {session.progress.length > 0 && (
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
          )}
        </article>
      ))}
    </section>
  );
}

/**
 * The last thing that happened, or the outcome once there is one. A session
 * that failed shows why rather than only that it did.
 */
function currentStep(session: WorkSession): string {
  if (session.status === "ready")
    return session.projectLocation === null
      ? (session.failureCode ?? "")
      : locationOf(session.projectLocation);
  const last = session.progress.at(-1);
  if (session.status === "failed")
    return last?.detail ?? session.failureCode ?? "";
  return last?.step ?? "Waiting for a worker…";
}

/** Wall-clock time only: the date is the session's own `createdAt`. */
function time(at: string): string {
  return at.slice(11, 19);
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

function remoteOf(config: unknown): string {
  if (typeof config !== "object" || config === null) return "";
  const remote = (config as { remote?: unknown }).remote;
  return typeof remote === "string" ? remote : "";
}
