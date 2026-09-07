import type { WorkspaceVisibility } from "../../domain-client/index.js";

import type { AppActionContext } from "./context.js";
import { createDraftForm } from "./draft-form.js";
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
  const form = createDraftForm(store, {
    form: "grant",
    changed: (draft: Partial<GrantDraft>) => ({
      type: "grant-draft-changed",
      draft,
    }),
    empty: emptyGrantDraft,
  });

  return {
    load: (organizationId: string, workspaceId: string) =>
      attempt(() => client.workspaceAccess.load(organizationId, workspaceId), {
        loaded: loadKeys.workspaceGrants(workspaceId),
      }),
    changeDraft: form.change,
    startGranting: form.open,
    cancelGranting: form.cancel,
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
          form.finish();
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
