import type { ProjectLocation } from "../db/schema.js";

/** One repository as the project needs it: a directory name and what to clone. */
export type ProjectRepository = {
  name: string;
  remote: string;
  ref?: string;
};

/**
 * Told about each step as it happens, so a caller can persist progress while
 * the work is still running rather than only learning the outcome. Awaited, so
 * steps are recorded in the order they occurred.
 */
export type ReportStep = (step: string, detail?: string) => Promise<void>;

export type EnsureProjectInput = {
  workspaceId: string;
  workspaceName: string;
  repositories: ProjectRepository[];
  report: ReportStep;
};

export type CloneForSessionInput = {
  project: ProjectLocation;
  workSessionId: string;
  branch: string;
  report: ReportStep;
};

/**
 * The two halves of opening a session on a workspace.
 *
 * A workspace owns **one** git project declaring its repositories as
 * submodules. The project holds no code: a submodule records where a repository
 * lives and which commit it is pinned to, never a checkout of it. That keeps a
 * workspace cheap to keep correct — adding, removing or re-pointing a
 * repository is a config edit, not a clone.
 *
 * A session is a **clone** of that project with its submodules checked out, so
 * the code is fetched per session, at the commits the project recorded.
 *
 * A port, not an implementation, because where projects live is what changes
 * between installations — directories on this machine while we run local, a
 * bucket once we run in the cloud. Nothing above this knows which.
 */
export type WorkspaceProjectBuilder = {
  /**
   * The workspace's project, built if it is missing and **reconciled** if it is
   * not: submodules the workspace no longer lists are removed, new ones added,
   * changed remotes and refs updated. Returning an existing project untouched
   * would mean a repository added today never reaches a session.
   */
  ensureWorkspaceProject: (
    input: EnsureProjectInput,
  ) => Promise<ProjectLocation>;
  /** A fresh working copy of the project, with its submodules, on `branch`. */
  cloneForSession: (input: CloneForSessionInput) => Promise<ProjectLocation>;
  /**
   * Puts every submodule on `branch`, creating it where it does not exist.
   * Submodules check out detached by default, so this is what makes the first
   * thing a user does — edit a file and commit — work as they expect.
   */
  branchAll: (location: ProjectLocation, branch: string) => Promise<void>;
};
