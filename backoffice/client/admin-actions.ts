import { ApiError, toApiError } from "../../client/errors.js";

import type { Api } from "./api.js";
import type { BackofficeStore } from "./projection.js";
import type { UserDraft } from "./state.js";

export function createAdminActions(api: Api, store: BackofficeStore) {
  const routes = api.admin;

  const loadUsers = async () => {
    const response = await routes.users.$get();
    if (!response.ok) throw await toApiError(response);
    store.dispatch({ type: "users-loaded", users: await response.json() });
  };

  const loadOrganizations = async () => {
    const response = await routes.organizations.$get();
    if (!response.ok) throw await toApiError(response);
    store.dispatch({
      type: "organizations-loaded",
      organizations: await response.json(),
    });
  };

  /**
   * Mutation failures become page state, so the flow (edit draft → submit →
   * error or fresh list) runs without any UI. Only auth failures rethrow:
   * the shell reacts to those by re-resolving the session.
   */
  const failed = (
    scope: "user-mutation-failed" | "organization-mutation-failed",
    caught: unknown,
  ) => {
    if (
      caught instanceof ApiError &&
      caught.code !== "AUTHENTICATION_REQUIRED"
    ) {
      store.dispatch({
        type: scope,
        error: { code: caught.code, message: caught.message },
      });
      return;
    }
    throw caught;
  };

  // Mutations reload the affected list so the state can never show stale
  // rows — the UI only ever renders what the store holds.
  return {
    loadUsers,
    loadOrganizations,
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
    setUsersFilter: (filter: string) => {
      store.dispatch({ type: "users-filter-set", filter });
    },
    openUserEditor: () => {
      store.dispatch({ type: "user-editor-toggled", open: true });
    },
    closeUserEditor: () => {
      store.dispatch({ type: "user-editor-toggled", open: false });
    },
    setUserDraft: (draft: Partial<UserDraft>) => {
      store.dispatch({ type: "user-draft-set", draft });
    },
    /** Submits the draft held in state; success closes the editor. */
    createUser: async () => {
      try {
        const response = await routes.users.$post({
          json: store.getState().usersPage.draft,
        });
        if (!response.ok) throw await toApiError(response);
        await loadUsers();
        store.dispatch({ type: "user-editor-toggled", open: false });
      } catch (caught) {
        failed("user-mutation-failed", caught);
      }
    },
    deleteUser: async (userId: string) => {
      try {
        const response = await routes.users[":userId"].$delete({
          param: { userId },
        });
        if (!response.ok) throw await toApiError(response);
        await loadUsers();
      } catch (caught) {
        failed("user-mutation-failed", caught);
      }
    },
    setOrganizationsFilter: (filter: string) => {
      store.dispatch({ type: "organizations-filter-set", filter });
    },
    setOrganizationDraft: (name: string) => {
      store.dispatch({ type: "organization-draft-set", name });
    },
    /** Submits the draft name held in state; success clears it. */
    createOrganization: async () => {
      try {
        const response = await routes.organizations.$post({
          json: { name: store.getState().organizationsPage.draftName },
        });
        if (!response.ok) throw await toApiError(response);
        await loadOrganizations();
        store.dispatch({ type: "organization-draft-set", name: "" });
      } catch (caught) {
        failed("organization-mutation-failed", caught);
      }
    },
    deleteOrganization: async (organizationId: string) => {
      try {
        const response = await routes.organizations[":organizationId"].$delete({
          param: { organizationId },
        });
        if (!response.ok) throw await toApiError(response);
        await loadOrganizations();
      } catch (caught) {
        failed("organization-mutation-failed", caught);
      }
    },
  };
}
