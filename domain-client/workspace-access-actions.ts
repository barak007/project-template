import type {
  Api,
  Workspace,
  WorkspaceGrant,
  WorkspaceGrantInput,
  WorkspaceVisibility,
} from "./api.js";
import { commit, commitEmpty } from "./commit.js";
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
      await commit(
        store,
        routes.grants.$get({ param: { organizationId, workspaceId } }),
        (grants: WorkspaceGrant[]) => ({
          type: "workspace-grants-loaded",
          organizationId,
          workspaceId,
          grants,
        }),
      );
    },
    putGrant: async (
      organizationId: string,
      workspaceId: string,
      input: WorkspaceGrantInput,
    ) => {
      await commit(
        store,
        routes.grants.$put({
          param: { organizationId, workspaceId },
          json: input,
        }),
        (grant: WorkspaceGrant) => ({
          type: "workspace-grant-put",
          organizationId,
          workspaceId,
          grant,
        }),
      );
    },
    removeGrant: async (
      organizationId: string,
      workspaceId: string,
      userId: string,
    ) => {
      await commitEmpty(
        store,
        routes.grants[":userId"].$delete({
          param: { organizationId, workspaceId, userId },
        }),
        {
          type: "workspace-grant-removed",
          organizationId,
          workspaceId,
          userId,
        },
      );
    },
    /** The whole workspace comes back, so the list the caller holds stays true. */
    setVisibility: async (
      organizationId: string,
      workspaceId: string,
      visibility: WorkspaceVisibility,
    ) => {
      await commit(
        store,
        routes.visibility.$put({
          param: { organizationId, workspaceId },
          json: { visibility },
        }),
        (workspace: Workspace) => ({
          type: "workspace-updated",
          organizationId,
          workspace,
        }),
      );
    },
  };
}
