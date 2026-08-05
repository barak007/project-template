import type { Api, OrganizationInput } from "./api.js";
import { toApiError } from "./errors.js";
import type { ClientStore } from "./projection.js";

export function createOrganizationActions(api: Api, store: ClientStore) {
  const routes = api.api.organizations;
  return {
    load: async () => {
      const response = await routes.$get();
      if (!response.ok) throw await toApiError(response);
      store.dispatch({
        type: "organizations-loaded",
        organizations: await response.json(),
      });
    },
    create: async (input: OrganizationInput) => {
      const response = await routes.$post({ json: input });
      if (!response.ok) throw await toApiError(response);
      store.dispatch({
        type: "organization-created",
        organization: await response.json(),
      });
    },
  };
}
