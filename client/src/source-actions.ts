import { readJson } from "./api.js";
import type { Api, Source, SourceInput } from "./api.js";
import { toApiError } from "./errors.js";
import type { ClientStore } from "./projection.js";

export function createSourceActions(api: Api, store: ClientStore) {
  const routes = api.api.organizations[":organizationId"].sources;
  return {
    load: async (organizationId: string) => {
      const response = await routes.$get({ param: { organizationId } });
      if (!response.ok) throw await toApiError(response);
      store.dispatch({
        type: "sources-loaded",
        organizationId,
        sources: await readJson<Source[]>(response),
      });
    },
    create: async (organizationId: string, input: SourceInput) => {
      const response = await routes.$post({
        param: { organizationId },
        json: input,
      });
      if (!response.ok) throw await toApiError(response);
      store.dispatch({
        type: "source-created",
        organizationId,
        source: await readJson<Source>(response),
      });
    },
    update: async (
      organizationId: string,
      sourceId: string,
      input: SourceInput,
    ) => {
      const response = await routes[":sourceId"].$put({
        param: { organizationId, sourceId },
        json: input,
      });
      if (!response.ok) throw await toApiError(response);
      store.dispatch({
        type: "source-updated",
        organizationId,
        source: await readJson<Source>(response),
      });
    },
    delete: async (organizationId: string, sourceId: string) => {
      const response = await routes[":sourceId"].$delete({
        param: { organizationId, sourceId },
      });
      if (!response.ok) throw await toApiError(response);
      store.dispatch({ type: "source-deleted", organizationId, sourceId });
    },
  };
}
