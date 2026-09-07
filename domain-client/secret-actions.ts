import type { Api, Secret, SecretInput } from "./api.js";
import { commit, commitEmpty } from "./commit.js";
import type { ClientStore } from "./projection.js";

export function createOrganizationSecretActions(api: Api, store: ClientStore) {
  const routes = api.api.organizations[":organizationId"].secrets;
  return {
    load: async (organizationId: string) => {
      await commit(
        store,
        routes.$get({ param: { organizationId } }),
        (secrets: Secret[]) => ({
          type: "organization-secrets-loaded",
          organizationId,
          secrets,
        }),
      );
    },
    put: async (organizationId: string, input: SecretInput) => {
      await commit(
        store,
        routes.$put({ param: { organizationId }, json: input }),
        (secret: Secret) => ({
          type: "organization-secret-put",
          organizationId,
          secret,
        }),
      );
    },
    delete: async (organizationId: string, key: string) => {
      await commitEmpty(
        store,
        routes[":key"].$delete({ param: { organizationId, key } }),
        { type: "organization-secret-deleted", organizationId, key },
      );
    },
  };
}

export function createUserSecretActions(api: Api, store: ClientStore) {
  const routes = api.api.me.secrets;
  return {
    load: async () => {
      await commit(store, routes.$get(), (secrets: Secret[]) => ({
        type: "user-secrets-loaded",
        secrets,
      }));
    },
    put: async (input: SecretInput) => {
      await commit(store, routes.$put({ json: input }), (secret: Secret) => ({
        type: "user-secret-put",
        secret,
      }));
    },
    delete: async (key: string) => {
      await commitEmpty(store, routes[":key"].$delete({ param: { key } }), {
        type: "user-secret-deleted",
        key,
      });
    },
  };
}
