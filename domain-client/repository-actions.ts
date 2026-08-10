import { readJson } from "./api.js";
import type { Api, RemoteRepository, RepositoryImport, Source } from "./api.js";
import { toApiError } from "./errors.js";
import type { ClientStore } from "./projection.js";

/**
 * The repositories the organization's connections expose. `load` reads them
 * from the providers; `importRepository` is what turns one into a source the
 * organization owns — importing the same repository twice yields the same
 * source, so it doubles as "give me the source for this repository".
 */
export function createRepositoryActions(api: Api, store: ClientStore) {
  const routes = api.api.organizations[":organizationId"].repositories;
  return {
    load: async (organizationId: string) => {
      const response = await routes.$get({ param: { organizationId } });
      if (!response.ok) throw await toApiError(response);
      store.dispatch({
        type: "repositories-loaded",
        organizationId,
        repositories: await readJson<RemoteRepository[]>(response),
      });
    },
    importRepository: async (
      organizationId: string,
      input: RepositoryImport,
    ) => {
      const response = await routes.$post({
        param: { organizationId },
        json: input,
      });
      if (!response.ok) throw await toApiError(response);
      const source = await readJson<Source>(response);
      // Not `source-created`: importing an already-imported repository returns
      // the source that exists, so this upserts rather than appends.
      store.dispatch({ type: "repository-imported", organizationId, source });
      return source;
    },
  };
}
