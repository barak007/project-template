import type { Api, WorkspaceInput } from "./api.js";
import { toApiError } from "./errors.js";
import type { ClientStore } from "./projection.js";

export function createWorkspaceActions(api: Api, store: ClientStore) {
  const routes = api.api.organizations[":organizationId"].workspaces;
  return {
    load: async (organizationId: string) => {
      const response = await routes.$get({ param: { organizationId } });
      if (!response.ok) throw await toApiError(response);
      store.dispatch({
        type: "workspaces-loaded",
        organizationId,
        workspaces: await response.json(),
      });
    },
    create: async (organizationId: string, input: WorkspaceInput) => {
      const response = await routes.$post({
        param: { organizationId },
        json: input,
      });
      if (!response.ok) throw await toApiError(response);
      store.dispatch({
        type: "workspace-created",
        organizationId,
        workspace: await response.json(),
      });
    },
    update: async (
      organizationId: string,
      workspaceId: string,
      input: WorkspaceInput,
    ) => {
      const response = await routes[":workspaceId"].$put({
        param: { organizationId, workspaceId },
        json: input,
      });
      if (!response.ok) throw await toApiError(response);
      store.dispatch({
        type: "workspace-updated",
        organizationId,
        workspace: await response.json(),
      });
    },
    delete: async (organizationId: string, workspaceId: string) => {
      const response = await routes[":workspaceId"].$delete({
        param: { organizationId, workspaceId },
      });
      if (!response.ok) throw await toApiError(response);
      store.dispatch({
        type: "workspace-deleted",
        organizationId,
        workspaceId,
      });
    },
  };
}
