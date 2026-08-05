import type { Api, MembershipInput } from "./api.js";
import { toApiError } from "./errors.js";
import type { ClientStore } from "./projection.js";

export function createMemberActions(api: Api, store: ClientStore) {
  const routes = api.api.organizations[":organizationId"].members;
  return {
    load: async (organizationId: string) => {
      const response = await routes.$get({ param: { organizationId } });
      if (!response.ok) throw await toApiError(response);
      store.dispatch({
        type: "members-loaded",
        organizationId,
        members: await response.json(),
      });
    },
    put: async (organizationId: string, input: MembershipInput) => {
      const response = await routes.$put({
        param: { organizationId },
        json: input,
      });
      if (!response.ok) throw await toApiError(response);
      store.dispatch({
        type: "membership-put",
        organizationId,
        membership: await response.json(),
      });
    },
  };
}
