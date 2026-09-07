import type { Api, Source, SourceInput } from "./api.js";
import { commit, commitEmpty } from "./commit.js";
import type { ClientStore } from "./projection.js";

export function createSourceActions(api: Api, store: ClientStore) {
  const routes = api.api.organizations[":organizationId"].sources;
  return {
    load: async (organizationId: string) => {
      await commit(
        store,
        routes.$get({ param: { organizationId } }),
        (sources: Source[]) => ({
          type: "sources-loaded",
          organizationId,
          sources,
        }),
      );
    },
    create: async (organizationId: string, input: SourceInput) => {
      await commit(
        store,
        routes.$post({ param: { organizationId }, json: input }),
        (source: Source) => ({
          type: "source-created",
          organizationId,
          source,
        }),
      );
    },
    update: async (
      organizationId: string,
      sourceId: string,
      input: SourceInput,
    ) => {
      await commit(
        store,
        routes[":sourceId"].$put({
          param: { organizationId, sourceId },
          json: input,
        }),
        (source: Source) => ({
          type: "source-updated",
          organizationId,
          source,
        }),
      );
    },
    delete: async (organizationId: string, sourceId: string) => {
      await commitEmpty(
        store,
        routes[":sourceId"].$delete({ param: { organizationId, sourceId } }),
        { type: "source-deleted", organizationId, sourceId },
      );
    },
  };
}
