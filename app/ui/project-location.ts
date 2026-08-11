import type { Workspace } from "../client/index.js";

/** Where a project lives is data, not a path — a directory today, a bucket later. */
export type ProjectLocation = NonNullable<Workspace["projectLocation"]>;

/**
 * The one line a user is shown about where a project lives. Informational: it
 * may name a machine they have no access to, which is exactly why the files
 * themselves come from the API and not from this path.
 */
export function locationOf(location: ProjectLocation): string {
  return location.kind === "local"
    ? location.path
    : `${location.bucket}/${location.prefix}`;
}
