import { ApiError, toApiError } from "../../client/errors.js";

import type { Api } from "./api.js";
import type { BackofficeStore } from "./projection.js";
import type { UserDraft } from "./state.js";

/**
 * Actions the generic table console cannot express: entity detail views and
 * the mutations with side effects beyond one row (a user's password
 * credential, an organization's restrict-prone work sessions). Everything
 * else on the users/organizations pages goes through the data actions.
 */
export function createAdminActions(
  api: Api,
  store: BackofficeStore,
  refreshTable: (table: string) => Promise<void>,
) {
  const routes = api.admin;

  return {
    loadUserDetail: async (userId: string) => {
      const response = await routes.users[":userId"].$get({
        param: { userId },
      });
      if (!response.ok) throw await toApiError(response);
      store.dispatch({
        type: "user-detail-loaded",
        detail: await response.json(),
      });
    },
    loadOrganizationDetail: async (organizationId: string) => {
      const response = await routes.organizations[":organizationId"].$get({
        param: { organizationId },
      });
      if (!response.ok) throw await toApiError(response);
      store.dispatch({
        type: "organization-detail-loaded",
        detail: await response.json(),
      });
    },
    setUserDraft: (draft: Partial<UserDraft>) => {
      store.dispatch({ type: "user-draft-set", draft });
    },
    resetUserEditor: () => {
      store.dispatch({ type: "user-editor-reset" });
    },
    /**
     * Submits the draft held in state. Failures become editor state so the
     * operator can correct the draft; success resets it and refreshes the
     * loaded user rows. Only auth failures rethrow: the shell reacts to
     * those by re-resolving the session.
     */
    createUser: async () => {
      try {
        const response = await routes.users.$post({
          json: store.getState().userEditor.draft,
        });
        if (!response.ok) throw await toApiError(response);
        store.dispatch({ type: "user-editor-reset" });
        await refreshTable("user");
      } catch (caught) {
        if (
          caught instanceof ApiError &&
          caught.code !== "AUTHENTICATION_REQUIRED"
        ) {
          store.dispatch({
            type: "user-mutation-failed",
            error: { code: caught.code, message: caught.message },
          });
          return;
        }
        throw caught;
      }
    },
    /** Clears the organization's work sessions before the cascade delete. */
    deleteOrganization: async (organizationId: string) => {
      const response = await routes.organizations[":organizationId"].$delete({
        param: { organizationId },
      });
      if (!response.ok) throw await toApiError(response);
      await refreshTable("organizations");
    },
  };
}
