import { describe, expect, it } from "vitest";

import type { ClientEvent } from "../events.js";
import { reduce } from "../projection.js";
import { initialState } from "../state.js";
import type { ClientState } from "../state.js";

const organizationId = "org-1";
const workSessionId = "session-1";

function fold(events: ClientEvent[]): ClientState {
  return events.reduce(reduce, initialState);
}

function directoryLoaded(
  path: string,
  names: string[],
  sessionId = workSessionId,
): ClientEvent {
  return {
    type: "session-directory-loaded",
    organizationId,
    workSessionId: sessionId,
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
 * session page's file tree.
 */
describe("a work session's file tree", () => {
  it("keeps each directory that has been opened, keyed by its path", () => {
    const state = fold([
      directoryLoaded("", ["notes", "README.md"]),
      directoryLoaded("notes", ["docs", "index.ts"]),
    ]);

    expect(state.sessionFiles.workSessionId).toBe(workSessionId);
    expect(Object.keys(state.sessionFiles.directories)).toEqual(["", "notes"]);
    expect(state.sessionFiles.directories.notes).toEqual([
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
      { type: "session-directory-collapsed", path: "notes" },
    ]);

    expect(Object.keys(state.sessionFiles.directories)).toEqual(["", "engine"]);
  });

  it("holds one session's files, so opening another starts from nothing", () => {
    const state = fold([
      directoryLoaded("", ["notes"]),
      directoryLoaded("notes", ["index.ts"]),
      {
        type: "session-file-loaded",
        organizationId,
        workSessionId,
        file: {
          path: "notes/index.ts",
          text: "const a = 1;",
          truncated: false,
        },
      },
      directoryLoaded("", ["engine"], "session-2"),
    ]);

    expect(state.sessionFiles).toEqual({
      workSessionId: "session-2",
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

    expect(state.sessionFiles).toEqual({
      workSessionId: null,
      directories: {},
      openFile: null,
    });
  });
});
