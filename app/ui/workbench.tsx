import { useEffect } from "react";

import type { AppCore, ProjectEntry, ProjectTarget } from "../client/index.js";

import { useAppState } from "./use-app-state.js";

/**
 * A git project as an editor: its file tree on the left, the open file on the
 * right. Used for a workspace's own project and for a session's clone of it —
 * the pages differ in their headers, not in this.
 *
 * Every byte comes from the API: the project may have been built on a machine
 * this browser cannot reach, so nothing here assumes a local disk.
 */
export function Workbench({
  core,
  organizationId,
  target,
}: {
  core: AppCore;
  organizationId: string;
  target: ProjectTarget;
}) {
  const files = useAppState(core, (state) => state.projectFiles);
  const loaded =
    files.target?.kind === target.kind && files.target.id === target.id;
  const rootLoaded = loaded && "" in files.directories;

  useEffect(() => {
    if (rootLoaded) return;
    void core.projectFiles.openRoot(organizationId, target);
    // The target is a fresh object each render, so the effect keys on its parts.
  }, [core, organizationId, target.kind, target.id, rootLoaded]);

  return (
    <div className="workbench">
      <nav className="file-tree" aria-label="Files">
        <Tree
          core={core}
          organizationId={organizationId}
          target={target}
          directories={loaded ? files.directories : {}}
          path=""
        />
      </nav>
      <article className="file-view">
        {!loaded || files.openFile === null ? (
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
  target,
  directories,
  path,
}: {
  core: AppCore;
  organizationId: string;
  target: ProjectTarget;
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
                  target,
                  entry.path,
                );
              }}
            >
              <span className="tree-caret" aria-hidden="true">
                {entry.path in directories ? "▾" : "▸"}
              </span>{" "}
              {entry.name}
            </button>
            <Tree
              core={core}
              organizationId={organizationId}
              target={target}
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
                  target,
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
