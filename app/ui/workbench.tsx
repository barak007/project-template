import { useEffect } from "react";
import type { KeyboardEvent } from "react";

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
      <nav className="file-tree" aria-label="Files" onKeyDown={navigate}>
        <ul className="tree" role="tree">
          <Tree
            core={core}
            organizationId={organizationId}
            target={target}
            directories={loaded ? files.directories : {}}
            openPath={loaded ? (files.openFile?.path ?? null) : null}
            path=""
            depth={1}
          />
        </ul>
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
 * Arrow keys through the tree, which is what makes it a tree and not a column of
 * buttons: Tab reaches it once, and movement inside it is the arrows.
 *
 * The expanded state is read back off the DOM (`aria-expanded`) rather than
 * threaded down from the store, because the only question being asked is about
 * the node that currently has focus.
 */
function navigate(event: KeyboardEvent<HTMLElement>) {
  const keys = [
    "ArrowDown",
    "ArrowUp",
    "ArrowRight",
    "ArrowLeft",
    "Home",
    "End",
  ];
  if (!keys.includes(event.key)) return;

  const nodes = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>(
      '[role="treeitem"]',
    ),
  );
  const active = nodes.indexOf(document.activeElement as HTMLButtonElement);
  if (active === -1) return;
  event.preventDefault();

  const node = nodes[active];
  const expanded = node?.getAttribute("aria-expanded");
  const focus = (index: number) => nodes[index]?.focus();

  switch (event.key) {
    case "ArrowDown":
      focus(Math.min(active + 1, nodes.length - 1));
      return;
    case "ArrowUp":
      focus(Math.max(active - 1, 0));
      return;
    case "Home":
      focus(0);
      return;
    case "End":
      focus(nodes.length - 1);
      return;
    case "ArrowRight":
      // A closed folder opens; anything already open moves into it.
      if (expanded === "false") node?.click();
      else focus(Math.min(active + 1, nodes.length - 1));
      return;
    case "ArrowLeft":
      // An open folder closes; anything else steps back out of the list.
      if (expanded === "true") node?.click();
      else focus(Math.max(active - 1, 0));
      return;
  }
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
  openPath,
  path,
  depth,
}: {
  core: AppCore;
  organizationId: string;
  target: ProjectTarget;
  directories: Record<string, ProjectEntry[]>;
  /** The file being read, so the tree can say which of them it is. */
  openPath: string | null;
  path: string;
  depth: number;
}) {
  const entries = directories[path];
  if (entries === undefined) return null;
  return (
    <>
      {entries.map((entry, index) => {
        // Exactly one node is reachable by Tab; the arrows do the rest.
        const tabIndex = depth === 1 && index === 0 ? 0 : -1;
        return entry.kind === "directory" ? (
          <li key={entry.path} role="none">
            <button
              className="tree-node"
              role="treeitem"
              aria-expanded={entry.path in directories}
              aria-level={depth}
              tabIndex={tabIndex}
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
              </span>
              <span>{entry.name}</span>
            </button>
            {entry.path in directories && (
              <ul className="tree" role="group">
                <Tree
                  core={core}
                  organizationId={organizationId}
                  target={target}
                  directories={directories}
                  openPath={openPath}
                  path={entry.path}
                  depth={depth + 1}
                />
              </ul>
            )}
          </li>
        ) : (
          <li key={entry.path} role="none">
            <button
              className="tree-node"
              role="treeitem"
              aria-level={depth}
              aria-current={entry.path === openPath}
              tabIndex={tabIndex}
              onClick={() => {
                void core.projectFiles.openFile(
                  organizationId,
                  target,
                  entry.path,
                );
              }}
            >
              <span className="tree-caret" aria-hidden="true" />
              <span>{entry.name}</span>
            </button>
          </li>
        );
      })}
    </>
  );
}
