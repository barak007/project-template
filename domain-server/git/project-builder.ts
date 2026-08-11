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
 * A workspace owns **one** git project holding its repositories as submodules.
 * A session is a **clone** of that project, so the second session on a
 * workspace copies what is already on disk instead of fetching every repository
 * from its host again.
 *
 * A port, not an implementation, because where projects live is what changes
 * between installations — directories on this machine while we run local, a
 * bucket once we run in the cloud. Nothing above this knows which.
 */
export type WorkspaceProjectBuilder = {
  /**
   * The workspace's project, built if it is missing and **reconciled** if it is
   * not: submodules the workspace no longer lists are removed, new ones added,
   * changed remotes updated. Returning an existing project untouched would mean
   * a repository added today never reaches a session.
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
