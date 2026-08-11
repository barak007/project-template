import { useEffect } from "react";

import {
  currentOrganization,
  currentWorkSession,
  currentWorkspace,
} from "../client/index.js";
import type { AppCore, ProjectEntry, WorkSession } from "../client/index.js";

import { ErrorBanner } from "./error-banner.js";
import { RouteLink } from "./route-link.js";
import { useAppState } from "./use-app-state.js";

/**
 * One session, as an editor: the project's files on the left, the open one on
 * the right. Every byte comes from the API — the project may have been built on
 * a machine this browser cannot reach, so nothing here assumes a local disk.
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
  const files = useAppState(core, (state) => state.sessionFiles);

  useEffect(() => {
    void core.organizations.load();
    void core.workspaces.load(organizationId);
    void core.workSessions.load(organizationId);
  }, [core, organizationId]);

  const preparing =
    session?.status === "pending" || session?.status === "materializing";
  const ready = session?.status === "ready";
  const rootLoaded =
    files.workSessionId === workSessionId && "" in files.directories;

  // The tree can only be read once a project exists, and a session that is
  // still being prepared becomes ready without anything the user does.
  useEffect(() => {
    if (!ready || rootLoaded) return;
    void core.projectFiles.openRoot(organizationId, workSessionId);
  }, [core, organizationId, workSessionId, ready, rootLoaded]);
  useEffect(() => {
    if (!preparing) return;
    const timer = setInterval(() => {
      void core.workSessions.refreshPending(organizationId);
    }, 1500);
    return () => clearInterval(timer);
  }, [core, organizationId, preparing]);

  return (
    <section className="page ide">
      <header className="page-header">
        <RouteLink
          core={core}
          to={{ kind: "workspace", organizationId, workspaceId }}
          className="link"
        >
          ← {workspace?.name ?? organization?.name ?? "Workspace"}
        </RouteLink>
        <h1>Session</h1>
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

      {session !== undefined && !ready ? (
        <p className="empty">
          {preparing
            ? "This session is still being prepared."
            : (session.failureCode ?? "This session has no project to open.")}
        </p>
      ) : (
        <div className="workbench">
          <nav className="file-tree" aria-label="Files">
            <Tree
              core={core}
              organizationId={organizationId}
              workSessionId={workSessionId}
              directories={files.directories}
              path=""
            />
          </nav>
          <article className="file-view">
            {files.openFile === null ? (
              <p className="empty">Pick a file to read it.</p>
            ) : (
              <>
                <header>
                  <strong>{files.openFile.path}</strong>
                  {files.openFile.truncated && (
                    <span className="muted"> · shown in part</span>
                  )}
                </header>
                <pre>
                  <code>{files.openFile.text}</code>
                </pre>
              </>
            )}
          </article>
        </div>
      )}
    </section>
  );
}

/**
 * One directory's children, and — for the folders that are open — theirs. An
 * open folder is one that has been read: the tree is loaded a level at a time,
 * so a repository with thousands of files costs a click, not a payload.
 */
function Tree({
  core,
  organizationId,
  workSessionId,
  directories,
  path,
}: {
  core: AppCore;
  organizationId: string;
  workSessionId: string;
  directories: Record<string, ProjectEntry[]>;
  path: string;
}) {
  const entries = directories[path];
  if (entries === undefined) return null;
  return (
    <ul className="tree">
      {entries.map((entry) =>
        entry.kind === "directory" ? (
          <li key={entry.path}>
            <button
              className="tree-node"
              aria-expanded={entry.path in directories}
              onClick={() => {
                void core.projectFiles.toggleDirectory(
                  organizationId,
                  workSessionId,
                  entry.path,
                );
              }}
            >
              {entry.path in directories ? "▾" : "▸"} {entry.name}
            </button>
            <Tree
              core={core}
              organizationId={organizationId}
              workSessionId={workSessionId}
              directories={directories}
              path={entry.path}
            />
          </li>
        ) : (
          <li key={entry.path}>
            <button
              className="tree-node"
              onClick={() => {
                void core.projectFiles.openFile(
                  organizationId,
                  workSessionId,
                  entry.path,
                );
              }}
            >
              {entry.name}
            </button>
          </li>
        ),
      )}
    </ul>
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
