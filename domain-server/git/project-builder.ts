import type { ProjectLocation } from "../db/schema.js";

/** One repository as the project needs it: a directory name and what to clone. */
export type ProjectRepository = {
  name: string;
  remote: string;
  ref?: string;
};

export type BuildProjectInput = {
  workSessionId: string;
  workspaceName: string;
  repositories: ProjectRepository[];
  branch: string;
};

/**
 * Builds the git project a work session opens: one repository containing the
 * workspace's repositories as submodules, which is the session's reflection of
 * the workspace config.
 *
 * A port, not an implementation, because where the project lands is what
 * changes between installations — a directory on this machine while we run
 * local, a bucket once we run in the cloud. Nothing above this knows which.
 */
export type WorkspaceProjectBuilder = {
  build: (input: BuildProjectInput) => Promise<ProjectLocation>;
  /**
   * Puts every submodule on `branch`, creating it where it does not exist.
   * Submodules check out detached by default, so this is what makes the first
   * thing a user does — edit a file and commit — work as they expect.
   */
  branchAll: (location: ProjectLocation, branch: string) => Promise<void>;
};
