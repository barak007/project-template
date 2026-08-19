import type { WorkspaceVisibility } from "../../domain-client/index.js";

import type { AppActionContext } from "./context.js";
import { actionKeys, loadKeys } from "./keys.js";
import { emptyGrantDraft } from "./state.js";
import type { GrantDraft } from "./state.js";

/**
 * Who may reach one workspace. Restricting it hides it from everyone in the
 * organization who has not been named — except its owners and admins, who manage
 * every workspace — so the page that offers this is the workspace's own.
 */
export function createWorkspaceAccessActions({
  client,
  store,
  attempt,
}: AppActionContext) {
  const clearDraft = () => {
    store.dispatch({ type: "grant-draft-changed", draft: emptyGrantDraft });
  };

  return {
    load: (organizationId: string, workspaceId: string) =>
      attempt(() => client.workspaceAccess.load(organizationId, workspaceId), {
        loaded: loadKeys.workspaceGrants(workspaceId),
      }),
    changeDraft: (draft: Partial<GrantDraft>) => {
      store.dispatch({ type: "grant-draft-changed", draft });
    },
    startGranting: () => {
      store.dispatch({ type: "create-form-opened", form: "grant" });
    },
    cancelGranting: () => {
      store.dispatch({ type: "create-form-closed" });
      clearDraft();
    },
    /** Gives the person in the draft access, and empties the form. */
    grant: (organizationId: string, workspaceId: string) =>
      attempt(
        async () => {
          const { userId, role } = store.getState().grantDraft;
          if (userId === "") return;
          await client.workspaceAccess.putGrant(organizationId, workspaceId, {
            userId,
            role,
          });
          clearDraft();
          store.dispatch({ type: "create-form-closed" });
        },
        { key: actionKeys.grantAccess },
      ),
    /** Changes access already granted, from the row rather than the form. */
    changeGrant: (
      organizationId: string,
      workspaceId: string,
      userId: string,
      role: GrantDraft["role"],
    ) =>
      attempt(
        () =>
          client.workspaceAccess.putGrant(organizationId, workspaceId, {
            userId,
            role,
          }),
        { key: actionKeys.changeGrant(userId) },
      ),
    removeGrant: (
      organizationId: string,
      workspaceId: string,
      userId: string,
    ) =>
      attempt(
        () =>
          client.workspaceAccess.removeGrant(
            organizationId,
            workspaceId,
            userId,
          ),
        { key: actionKeys.removeGrant(userId) },
      ),
    setVisibility: (
      organizationId: string,
      workspaceId: string,
      visibility: WorkspaceVisibility,
    ) =>
      attempt(
        () =>
          client.workspaceAccess.setVisibility(
            organizationId,
            workspaceId,
            visibility,
          ),
        { key: actionKeys.setVisibility(workspaceId) },
      ),
  };
}
