import type { Api, Workspace, WorkspaceInput } from "./api.js";
import { commit, commitEmpty } from "./commit.js";
import type { ClientStore } from "./projection.js";

export function createWorkspaceActions(api: Api, store: ClientStore) {
  const routes = api.api.organizations[":organizationId"].workspaces;
  return {
    load: async (organizationId: string) => {
      await commit(
        store,
        routes.$get({ param: { organizationId } }),
        (workspaces: Workspace[]) => ({
          type: "workspaces-loaded",
          organizationId,
          workspaces,
        }),
      );
    },
    create: async (organizationId: string, input: WorkspaceInput) => {
      await commit(
        store,
        routes.$post({ param: { organizationId }, json: input }),
        (workspace: Workspace) => ({
          type: "workspace-created",
          organizationId,
          workspace,
        }),
      );
    },
    update: async (
      organizationId: string,
      workspaceId: string,
      input: WorkspaceInput,
    ) => {
      await commit(
        store,
        routes[":workspaceId"].$put({
          param: { organizationId, workspaceId },
          json: input,
        }),
        (workspace: Workspace) => ({
          type: "workspace-updated",
          organizationId,
          workspace,
        }),
      );
    },
    delete: async (organizationId: string, workspaceId: string) => {
      await commitEmpty(
        store,
        routes[":workspaceId"].$delete({
          param: { organizationId, workspaceId },
        }),
        { type: "workspace-deleted", organizationId, workspaceId },
      );
    },
  };
}
