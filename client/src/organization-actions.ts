import type { Api } from "./api.js";
import { toApiError } from "./errors.js";
import type { ClientState } from "./state.js";
import type { Store } from "./store.js";

export function createOrganizationActions(api: Api, store: Store<ClientState>) {
  return {
    loadOrganizations: async () => {
      const response = await api.api.organizations.$get();
      if (!response.ok) throw await toApiError(response);
      const organizations = await response.json();
      store.setState((state) => ({ ...state, organizations }));
    },
    createOrganization: async (input: { name: string }) => {
      const response = await api.api.organizations.$post({ json: input });
      if (!response.ok) throw await toApiError(response);
      const organization = await response.json();
      store.setState((state) => ({
        ...state,
        organizations: [...state.organizations, organization],
      }));
    },
  };
}
