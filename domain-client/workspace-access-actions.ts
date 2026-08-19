import type {
  Api,
  WorkspaceGrantInput,
  WorkspaceVisibility,
} from "./api.js";
import { toApiError } from "./errors.js";
import type { ClientStore } from "./projection.js";

/**
 * Who may reach one workspace. Two levers, both held by whoever manages the
 * workspace: **visibility** decides whether the organization at large can see it
 * at all, and a **grant** names one person and what they may do with it.
 *
 * Grants only add. An organization's owners and admins manage every workspace
 * whatever the grants say, so this is never the way to lock somebody out — it is
 * the way to let somebody in.
 */
export function createWorkspaceAccessActions(api: Api, store: ClientStore) {
  const routes =
    api.api.organizations[":organizationId"].workspaces[":workspaceId"];
  return {
    load: async (organizationId: string, workspaceId: string) => {
      const response = await routes.grants.$get({
        param: { organizationId, workspaceId },
      });
      if (!response.ok) throw await toApiError(response);
      store.dispatch({
        type: "workspace-grants-loaded",
        organizationId,
        workspaceId,
        grants: await response.json(),
      });
    },
    putGrant: async (
      organizationId: string,
      workspaceId: string,
      input: WorkspaceGrantInput,
    ) => {
      const response = await routes.grants.$put({
        param: { organizationId, workspaceId },
        json: input,
      });
      if (!response.ok) throw await toApiError(response);
      store.dispatch({
        type: "workspace-grant-put",
        organizationId,
        workspaceId,
        grant: await response.json(),
      });
    },
    removeGrant: async (
      organizationId: string,
      workspaceId: string,
      userId: string,
    ) => {
      const response = await routes.grants[":userId"].$delete({
        param: { organizationId, workspaceId, userId },
      });
      if (!response.ok) throw await toApiError(response);
      store.dispatch({
        type: "workspace-grant-removed",
        organizationId,
        workspaceId,
        userId,
      });
    },
    /** The whole workspace comes back, so the list the caller holds stays true. */
    setVisibility: async (
      organizationId: string,
      workspaceId: string,
      visibility: WorkspaceVisibility,
    ) => {
      const response = await routes.visibility.$put({
        param: { organizationId, workspaceId },
        json: { visibility },
      });
      if (!response.ok) throw await toApiError(response);
      store.dispatch({
        type: "workspace-updated",
        organizationId,
        workspace: await response.json(),
      });
    },
  };
}
