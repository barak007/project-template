import type { Api, DataEntry, DataInput } from "./api.js";
import { commit } from "./commit.js";
import type { ClientStore } from "./projection.js";

export function createOrganizationDataActions(api: Api, store: ClientStore) {
  const routes = api.api.organizations[":organizationId"].data;
  return {
    load: async (organizationId: string) => {
      await commit(
        store,
        routes.$get({ param: { organizationId } }),
        (data: DataEntry[]) => ({
          type: "organization-data-loaded",
          organizationId,
          data,
        }),
      );
    },
    put: async (organizationId: string, input: DataInput) => {
      await commit(
        store,
        routes.$put({ param: { organizationId }, json: input }),
        (entry: DataEntry) => ({
          type: "organization-data-put",
          organizationId,
          entry,
        }),
      );
    },
  };
}

export function createUserDataActions(api: Api, store: ClientStore) {
  const routes = api.api.me.data;
  return {
    load: async () => {
      await commit(store, routes.$get(), (data: DataEntry[]) => ({
        type: "user-data-loaded",
        data,
      }));
    },
    put: async (input: DataInput) => {
      await commit(store, routes.$put({ json: input }), (entry: DataEntry) => ({
        type: "user-data-put",
        entry,
      }));
    },
  };
}
