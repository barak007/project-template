import type { Api, WorkSession } from "./api.js";
import { commit } from "./commit.js";
import type { ClientStore } from "./projection.js";

export function createWorkSessionActions(api: Api, store: ClientStore) {
  const routes = api.api.organizations[":organizationId"]["work-sessions"];
  return {
    load: async (organizationId: string) => {
      await commit(
        store,
        routes.$get({ param: { organizationId } }),
        (workSessions: WorkSession[]) => ({
          type: "work-sessions-loaded",
          organizationId,
          workSessions,
        }),
      );
    },
    start: async (organizationId: string, workspaceId: string) => {
      await commit(
        store,
        routes.$post({ param: { organizationId }, json: { workspaceId } }),
        (workSession: WorkSession) => ({
          type: "work-session-started",
          organizationId,
          workSession,
        }),
      );
    },
    refresh: async (organizationId: string, workSessionId: string) => {
      await commit(
        store,
        routes[":workSessionId"].$get({
          param: { organizationId, workSessionId },
        }),
        (workSession: WorkSession) => ({
          type: "work-session-refreshed",
          organizationId,
          workSession,
        }),
      );
    },
    /**
     * Puts every repository in the session's project on one branch — the
     * command that makes a freshly cloned submodule committable.
     */
    branchAll: async (
      organizationId: string,
      workSessionId: string,
      branch: string,
    ) => {
      await commit(
        store,
        routes[":workSessionId"].project.branch.$post({
          param: { organizationId, workSessionId },
          json: { branch },
        }),
        (workSession: WorkSession) => ({
          type: "work-session-refreshed",
          organizationId,
          workSession,
        }),
      );
    },
  };
}
