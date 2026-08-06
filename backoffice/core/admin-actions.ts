import { toApiError } from "../../client/src/errors.js";

import type { Api } from "./api.js";
import type { BackofficeStore } from "./projection.js";

export function createAdminActions(api: Api, store: BackofficeStore) {
  const routes = api.admin;
  return {
    loadUsers: async () => {
      const response = await routes.users.$get();
      if (!response.ok) throw await toApiError(response);
      store.dispatch({ type: "users-loaded", users: await response.json() });
    },
    loadOrganizations: async () => {
      const response = await routes.organizations.$get();
      if (!response.ok) throw await toApiError(response);
      store.dispatch({
        type: "organizations-loaded",
        organizations: await response.json(),
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
  };
}
