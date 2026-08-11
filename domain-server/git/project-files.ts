import type { ProjectLocation } from "../db/schema.js";

/** One child of a directory, at a path relative to the project root. */
export type ProjectEntry = {
  name: string;
  /** Slash-separated, relative to the project root; `""` is the root itself. */
  path: string;
  kind: "file" | "directory";
};

/** A text file as an editor shows it, cut off rather than refused when huge. */
export type ProjectFile = {
  path: string;
  text: string;
  truncated: boolean;
};

/**
 * Reading a session's project as a tree of text.
 *
 * Separate from [WorkspaceProjectBuilder](./project-builder.ts): building a
 * project is a write that runs git, browsing one is a read the API answers on
 * every keystroke of a user opening files.
 *
 * A port, not an implementation, for the same reason a project's location is
 * data: the files are a directory on the server while we run local and a bucket
 * once we do not. **Nothing above this reads a filesystem** — the browser asks
 * the API for a listing and for one file at a time, so a session prepared on a
 * machine the user has no access to opens exactly the same way.
 */
export type ProjectFiles = {
  /** The children of one directory — a tree is expanded a level at a time. */
  listDirectory: (
    location: ProjectLocation,
    path: string,
  ) => Promise<ProjectEntry[]>;
  readFile: (location: ProjectLocation, path: string) => Promise<ProjectFile>;
};
