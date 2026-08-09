import { readJson } from "./api.js";
import type { Api, WorkSession } from "./api.js";
import { toApiError } from "./errors.js";
import type { ClientStore } from "./projection.js";

export function createWorkSessionActions(api: Api, store: ClientStore) {
  const routes = api.api.organizations[":organizationId"]["work-sessions"];
  return {
    load: async (organizationId: string) => {
      const response = await routes.$get({ param: { organizationId } });
      if (!response.ok) throw await toApiError(response);
      store.dispatch({
        type: "work-sessions-loaded",
        organizationId,
        workSessions: await readJson<WorkSession[]>(response),
      });
    },
    start: async (organizationId: string, workspaceId: string) => {
      const response = await routes.$post({
        param: { organizationId },
        json: { workspaceId },
      });
      if (!response.ok) throw await toApiError(response);
      store.dispatch({
        type: "work-session-started",
        organizationId,
        workSession: await readJson<WorkSession>(response),
      });
    },
    refresh: async (organizationId: string, workSessionId: string) => {
      const response = await routes[":workSessionId"].$get({
        param: { organizationId, workSessionId },
      });
      if (!response.ok) throw await toApiError(response);
      store.dispatch({
        type: "work-session-refreshed",
        organizationId,
        workSession: await readJson<WorkSession>(response),
      });
    },
  };
}
