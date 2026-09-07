import type { Api, Organization, OrganizationInput } from "./api.js";
import { commit } from "./commit.js";
import type { ClientStore } from "./projection.js";

export function createOrganizationActions(api: Api, store: ClientStore) {
  const routes = api.api.organizations;
  return {
    load: async () => {
      await commit(store, routes.$get(), (organizations: Organization[]) => ({
        type: "organizations-loaded",
        organizations,
      }));
    },
    create: async (input: OrganizationInput) => {
      await commit(
        store,
        routes.$post({ json: input }),
        (organization: Organization) => ({
          type: "organization-created",
          organization,
        }),
      );
    },
  };
}
