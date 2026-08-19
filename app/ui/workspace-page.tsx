import { useEffect } from "react";

import {
  actionKeys,
  confirmKeys,
  currentWorkspace,
  hasLoaded,
  isPending,
  loadKeys,
  managesWorkspace,
  runsWorkspace,
  workspaceRole,
} from "../client/index.js";
import type { AppCore } from "../client/index.js";

import { ConfirmButton } from "./confirm-button.js";
import { CreateForm } from "./create-form.js";
import { EntityIcon } from "./entity-icon.js";
import { ErrorBanner } from "./error-banner.js";
import { PageHeader } from "./page-header.js";
import { locationOf } from "./project-location.js";
import { RouteLink } from "./route-link.js";
import { Section } from "./section.js";
import { SessionCard } from "./session-card.js";
import { Skeleton } from "./skeleton.js";
import { useAppState } from "./use-app-state.js";
import { WorkspaceAccessSection } from "./workspace-access-section.js";

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
  const workspace = useAppState(core, currentWorkspace);
  const manages = useAppState(core, (state) =>
    managesWorkspace(state, workspaceId),
  );
  const runs = useAppState(core, (state) => runsWorkspace(state, workspaceId));
  // Changing what a workspace points at is the editor's; running sessions on it
  // is the operator's. A viewer is offered neither rather than refused later.
  const edits = useAppState(core, (state) => {
    const role = workspaceRole(state, workspaceId);
    return role === "editor" || role === "manager";
  });
  const sources = useAppState(core, (state) => state.sources);
  const workSessions = useAppState(core, (state) => state.workSessions);
  const draft = useAppState(core, (state) => state.repositoryDraft);
  const members = useAppState(core, (state) => state.members.length);
  const repositoriesLoaded = useAppState(core, (state) =>
    hasLoaded(state, loadKeys.repositories(organizationId)),
  );
  const sessionsLoaded = useAppState(core, (state) =>
    hasLoaded(state, loadKeys.sessions(organizationId)),
  );
  const adding = useAppState(core, (state) => state.openForm === "repository");
  const addPending = useAppState(core, (state) =>
    isPending(state, actionKeys.addRepository),
  );
  const createPending = useAppState(core, (state) =>
    isPending(state, actionKeys.createSession(workspaceId)),
  );

  useEffect(() => {
    void core.organizations.load();
    void core.workspaces.load(organizationId);
    void core.repositories.load(organizationId);
    void core.workSessions.load(organizationId);
    void core.members.load(organizationId);
  }, [core, organizationId]);

  // Only a manager may read the grants, and only the workspace list can say
  // whether this viewer is one — so this waits for it rather than asking blind.
  useEffect(() => {
    if (!manages) return;
    void core.workspaceAccess.load(organizationId, workspaceId);
  }, [core, organizationId, workspaceId, manages]);

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

  const addForm = (
    <CreateForm
      label="Repository URL"
      placeholder="https://github.com/owner/repository.git"
      value={draft}
      pending={addPending}
      submitLabel="Add repository"
      onChange={(remote) => {
        core.repositories.draft(remote);
      }}
      onSubmit={() => {
        void core.repositories.add(organizationId, workspaceId);
      }}
      onCancel={() => {
        core.repositories.cancelAdding();
      }}
    />
  );

  return (
    <section className="page">
      <PageHeader
        core={core}
        entity="workspace"
        title={workspace?.name ?? "Workspace"}
        lead="A session clones these repositories into one project."
        action={
          // The page's one primary action. Disabled rather than hidden: a user
          // who cannot see it does not learn what it needs.
          <button
            type="button"
            disabled={attached.length === 0 || createPending || !runs}
            aria-busy={createPending}
            title={
              !runs
                ? "You can look at this workspace, but not open sessions on it."
                : attached.length === 0
                  ? "Add a repository first — a session opens these."
                  : undefined
            }
            onClick={() => {
              void core.workSessions.create(organizationId, workspaceId);
            }}
          >
            {createPending ? "Starting…" : "New session"}
          </button>
        }
      />
      <ErrorBanner core={core} />

      {/* The workspace owns one git project — the template each session clones.
          It is built by the first session, so before that there is nothing to
          open, and the row says so rather than leading to an error. */}
      <Section title="Project">
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
      </Section>

      <Section
        title="Repositories"
        action={
          edits && attached.length > 0 && !adding ? (
            <button
              type="button"
              className="ghost small"
              onClick={() => {
                core.repositories.startAdding();
              }}
            >
              Add repository
            </button>
          ) : undefined
        }
      >
        {edits && adding && attached.length > 0 ? addForm : null}
        {!repositoriesLoaded ? (
          <Skeleton rows={2} />
        ) : attached.length === 0 ? (
          <div className="empty">
            <p>
              {edits
                ? "No repositories yet. Paste a git URL — nothing has to be connected first."
                : "No repositories yet. Whoever manages this workspace decides what it works on."}
            </p>
            {edits ? addForm : null}
          </div>
        ) : (
          <ul className="rows">
            {attached.map((source) => (
              <li key={source.id}>
                <div className="row-main">
                  <strong className="entity-chip">
                    <EntityIcon entity="repository" />
                    {source.name}
                  </strong>
                  <span className="muted">{remoteOf(source.config)}</span>
                </div>
                <div className="row-actions">
                  {!edits ? null : (
                  <ConfirmButton
                    core={core}
                    confirmKey={confirmKeys.removeRepository(source.id)}
                    actionKey={actionKeys.removeRepository(source.id)}
                    label="Remove"
                    question={`Remove ${source.name} from this workspace?`}
                    onConfirm={() => {
                      void core.repositories.remove(
                        organizationId,
                        workspaceId,
                        source.id,
                      );
                    }}
                  />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Sessions"
        note={
          sessionsLoaded && sessions.length > 0
            ? `${String(sessions.length)} in this workspace`
            : undefined
        }
      >
        {!sessionsLoaded ? (
          <Skeleton rows={2} />
        ) : sessions.length === 0 ? (
          <div className="empty">
            <p>
              {attached.length === 0
                ? "A session clones this workspace’s repositories. Add one first."
                : "No sessions yet. Starting one clones every repository above into a project."}
            </p>
          </div>
        ) : (
          <div className="rows">
            {sessions.map((session) => (
              <SessionCard
                key={session.id}
                core={core}
                session={session}
                organizationId={organizationId}
                workspaceId={workspaceId}
              />
            ))}
          </div>
        )}
      </Section>

      {/* Managing access is the manager's; everyone else is told what applies
          rather than shown controls the server would refuse. */}
      {manages && workspace ? (
        <WorkspaceAccessSection
          core={core}
          organizationId={organizationId}
          workspaceId={workspaceId}
          visibility={workspace.visibility}
        />
      ) : (
        <Section title="Access">
          <div className="project-row for-organization">
            <EntityIcon entity="organization" />
            <span className="muted">
              {workspace?.visibility === "restricted"
                ? "This workspace is restricted to the people its manager has named."
                : "Everyone in this organization can open this workspace."}
            </span>
            <RouteLink
              core={core}
              to={{ kind: "organization", organizationId }}
              className="link"
            >
              {members === 1 ? "1 member" : `${String(members)} members`}
            </RouteLink>
          </div>
        </Section>
      )}
    </section>
  );
}

function remoteOf(config: unknown): string {
  if (typeof config !== "object" || config === null) return "";
  const remote = (config as { remote?: unknown }).remote;
  return typeof remote === "string" ? remote : "";
}
