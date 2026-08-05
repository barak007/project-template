import { readJson } from "./api.js";
import type { Api, DataEntry, DataInput } from "./api.js";
import { toApiError } from "./errors.js";
import type { ClientStore } from "./projection.js";

export function createOrganizationDataActions(api: Api, store: ClientStore) {
  const routes = api.api.organizations[":organizationId"].data;
  return {
    load: async (organizationId: string) => {
      const response = await routes.$get({ param: { organizationId } });
      if (!response.ok) throw await toApiError(response);
      store.dispatch({
        type: "organization-data-loaded",
        organizationId,
        data: await readJson<DataEntry[]>(response),
      });
    },
    put: async (organizationId: string, input: DataInput) => {
      const response = await routes.$put({
        param: { organizationId },
        json: input,
      });
      if (!response.ok) throw await toApiError(response);
      store.dispatch({
        type: "organization-data-put",
        organizationId,
        entry: await readJson<DataEntry>(response),
      });
    },
  };
}

export function createUserDataActions(api: Api, store: ClientStore) {
  const routes = api.api.me.data;
  return {
    load: async () => {
      const response = await routes.$get();
      if (!response.ok) throw await toApiError(response);
      store.dispatch({
        type: "user-data-loaded",
        data: await readJson<DataEntry[]>(response),
      });
    },
    put: async (input: DataInput) => {
      const response = await routes.$put({ json: input });
      if (!response.ok) throw await toApiError(response);
      store.dispatch({
        type: "user-data-put",
        entry: await readJson<DataEntry>(response),
      });
    },
  };
}
