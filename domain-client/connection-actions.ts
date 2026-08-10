import { readJson } from "./api.js";
import type { Api, Connection, ConnectionInput } from "./api.js";
import { toApiError } from "./errors.js";
import type { ClientStore } from "./projection.js";

/**
 * Where an organization's repositories come from. Connecting is idempotent per
 * provider — reconnecting replaces the connection rather than adding one — so
 * there is a `connect`, not a `create` and an `update`.
 */
export function createConnectionActions(api: Api, store: ClientStore) {
  const routes = api.api.organizations[":organizationId"].connections;
  return {
    load: async (organizationId: string) => {
      const response = await routes.$get({ param: { organizationId } });
      if (!response.ok) throw await toApiError(response);
      store.dispatch({
        type: "connections-loaded",
        organizationId,
        connections: await readJson<Connection[]>(response),
      });
    },
    connect: async (organizationId: string, input: ConnectionInput) => {
      const response = await routes.$put({
        param: { organizationId },
        json: input,
      });
      if (!response.ok) throw await toApiError(response);
      store.dispatch({
        type: "connection-put",
        organizationId,
        connection: await readJson<Connection>(response),
      });
    },
    disconnect: async (organizationId: string, connectionId: string) => {
      const response = await routes[":connectionId"].$delete({
        param: { organizationId, connectionId },
      });
      if (!response.ok) throw await toApiError(response);
      store.dispatch({
        type: "connection-deleted",
        organizationId,
        connectionId,
      });
    },
  };
}
