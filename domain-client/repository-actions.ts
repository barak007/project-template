import { readJson } from "./api.js";
import type { Api, RepositoryInput, Source } from "./api.js";
import { toApiError } from "./errors.js";
import type { ClientStore } from "./projection.js";

/**
 * Adding a repository is defining one: a remote URL becomes a `git` source the
 * organization owns. There is nothing to list — no account exposes a catalogue —
 * so `sources` is the only place repositories live, and adding the same URL
 * twice yields the source that already exists.
 */
export function createRepositoryActions(api: Api, store: ClientStore) {
  const routes = api.api.organizations[":organizationId"].repositories;
  return {
    add: async (organizationId: string, input: RepositoryInput) => {
      const response = await routes.$post({
        param: { organizationId },
        json: input,
      });
      if (!response.ok) throw await toApiError(response);
      const source = await readJson<Source>(response);
      // Upserts rather than appends: the same URL twice is the same source.
      store.dispatch({ type: "repository-added", organizationId, source });
      return source;
    },
  };
}
