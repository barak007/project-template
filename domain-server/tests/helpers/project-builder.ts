import type { ProjectLocation } from "../../db/schema.js";
import type {
  CloneForSessionInput,
  EnsureProjectInput,
  WorkspaceProjectBuilder,
} from "../../git/project-builder.js";

/**
 * A builder that records instead of running git. Route and job tests are about
 * what gets asked of the port and what lands in the database; whether git
 * itself does the right thing is [local-project-builder.test.ts](../local-project-builder.test.ts),
 * against real repositories.
 */
export function recordingProjectBuilder() {
  const ensured: EnsureProjectInput[] = [];
  const cloned: CloneForSessionInput[] = [];
  const branched: { location: ProjectLocation; branch: string }[] = [];
  const projectBuilder: WorkspaceProjectBuilder = {
    // Both report, because how a caller persists progress is part of the
    // contract a stub has to honour — a silent stub would let the job's
    // progress trail rot untested.
    ensureWorkspaceProject: async (input) => {
      ensured.push(input);
      await input.report("Creating the workspace project");
      return {
        kind: "local",
        path: `/tmp/${input.workspaceId}/project`,
      };
    },
    cloneForSession: async (input) => {
      cloned.push(input);
      await input.report("Cloning the workspace project");
      await input.report("Session ready");
      return {
        kind: "local",
        path: `/tmp/sessions/${input.workSessionId}`,
      };
    },
    branchAll: (location, branch) => {
      branched.push({ location, branch });
      return Promise.resolve();
    },
  };
  return { projectBuilder, ensured, cloned, branched };
}
