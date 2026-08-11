import { describe, expect, it } from "vitest";

import type { ClientEvent } from "../events.js";
import { reduce } from "../projection.js";
import { initialState } from "../state.js";
import type { ClientState, ProjectTarget } from "../state.js";

const organizationId = "org-1";
const session = { kind: "session" as const, id: "session-1" };

function fold(events: ClientEvent[]): ClientState {
  return events.reduce(reduce, initialState);
}

function directoryLoaded(
  path: string,
  names: string[],
  target: ProjectTarget = session,
): ClientEvent {
  return {
    type: "project-directory-loaded",
    organizationId,
    target,
    path,
    entries: names.map((name) => ({
      name,
      path: path === "" ? name : `${path}/${name}`,
      kind: name.includes(".") ? ("file" as const) : ("directory" as const),
    })),
  };
}

/**
 * The tree is state, not a component's memory: which folders are open is
 * exactly which ones have been read, so this fold is the whole behaviour of the
 * file tree on both project pages.
 */
describe("a project's file tree", () => {
  it("keeps each directory that has been opened, keyed by its path", () => {
    const state = fold([
      directoryLoaded("", ["notes", "README.md"]),
      directoryLoaded("notes", ["docs", "index.ts"]),
    ]);

    expect(state.projectFiles.target).toEqual(session);
    expect(Object.keys(state.projectFiles.directories)).toEqual(["", "notes"]);
    expect(state.projectFiles.directories.notes).toEqual([
      { name: "docs", path: "notes/docs", kind: "directory" },
      { name: "index.ts", path: "notes/index.ts", kind: "file" },
    ]);
  });

  it("closes everything below a collapsed folder, and nothing beside it", () => {
    const state = fold([
      directoryLoaded("", ["notes", "engine"]),
      directoryLoaded("notes", ["docs"]),
      directoryLoaded("notes/docs", ["guide.md"]),
      directoryLoaded("engine", ["src"]),
      { type: "project-directory-collapsed", path: "notes" },
    ]);

    expect(Object.keys(state.projectFiles.directories)).toEqual(["", "engine"]);
  });

  it("holds one project's files, so opening another starts from nothing", () => {
    const state = fold([
      directoryLoaded("", ["notes"]),
      directoryLoaded("notes", ["index.ts"]),
      {
        type: "project-file-loaded",
        organizationId,
        target: session,
        file: {
          path: "notes/index.ts",
          text: "const a = 1;",
          truncated: false,
        },
      },
      // The workspace's own project, which is a different project entirely.
      directoryLoaded("", ["engine"], { kind: "workspace", id: "ws-1" }),
    ]);

    expect(state.projectFiles).toEqual({
      target: { kind: "workspace", id: "ws-1" },
      directories: {
        "": [{ name: "engine", path: "engine", kind: "directory" }],
      },
      openFile: null,
    });
  });

  it("drops the tree when the organization changes under it", () => {
    const state = fold([
      directoryLoaded("", ["notes"]),
      {
        type: "workspaces-loaded",
        organizationId: "org-2",
        workspaces: [],
      },
    ]);

    expect(state.projectFiles).toEqual({
      target: null,
      directories: {},
      openFile: null,
    });
  });
});
