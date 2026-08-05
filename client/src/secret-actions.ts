import type { Api, SecretInput } from "./api.js";
import { toApiError } from "./errors.js";
import type { ClientStore } from "./projection.js";

export function createOrganizationSecretActions(api: Api, store: ClientStore) {
  const routes = api.api.organizations[":organizationId"].secrets;
  return {
    load: async (organizationId: string) => {
      const response = await routes.$get({ param: { organizationId } });
      if (!response.ok) throw await toApiError(response);
      store.dispatch({
        type: "organization-secrets-loaded",
        organizationId,
        secrets: await response.json(),
      });
    },
    put: async (organizationId: string, input: SecretInput) => {
      const response = await routes.$put({
        param: { organizationId },
        json: input,
      });
      if (!response.ok) throw await toApiError(response);
      store.dispatch({
        type: "organization-secret-put",
        organizationId,
        secret: await response.json(),
      });
    },
    delete: async (organizationId: string, key: string) => {
      const response = await routes[":key"].$delete({
        param: { organizationId, key },
      });
      if (!response.ok) throw await toApiError(response);
      store.dispatch({
        type: "organization-secret-deleted",
        organizationId,
        key,
      });
    },
  };
}

export function createUserSecretActions(api: Api, store: ClientStore) {
  const routes = api.api.me.secrets;
  return {
    load: async () => {
      const response = await routes.$get();
      if (!response.ok) throw await toApiError(response);
      store.dispatch({
        type: "user-secrets-loaded",
        secrets: await response.json(),
      });
    },
    put: async (input: SecretInput) => {
      const response = await routes.$put({ json: input });
      if (!response.ok) throw await toApiError(response);
      store.dispatch({
        type: "user-secret-put",
        secret: await response.json(),
      });
    },
    delete: async (key: string) => {
      const response = await routes[":key"].$delete({ param: { key } });
      if (!response.ok) throw await toApiError(response);
      store.dispatch({ type: "user-secret-deleted", key });
    },
  };
}
