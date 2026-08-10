import type { ProjectLocation } from "../../db/schema.js";
import type {
  BuildProjectInput,
  WorkspaceProjectBuilder,
} from "../../git/project-builder.js";

/**
 * A builder that records instead of running git. Route and job tests are about
 * what gets asked of the port and what lands in the database; whether git
 * itself does the right thing is [local-project-builder.test.ts](../local-project-builder.test.ts),
 * against real repositories.
 */
export function recordingProjectBuilder() {
  const built: BuildProjectInput[] = [];
  const branched: { location: ProjectLocation; branch: string }[] = [];
  const projectBuilder: WorkspaceProjectBuilder = {
    build: (input) => {
      built.push(input);
      return Promise.resolve({
        kind: "local",
        path: `/tmp/${input.workSessionId}`,
      });
    },
    branchAll: (location, branch) => {
      branched.push({ location, branch });
      return Promise.resolve();
    },
  };
  return { projectBuilder, built, branched };
}
