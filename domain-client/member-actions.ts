import type { Api, Membership, MembershipInput } from "./api.js";
import { commit } from "./commit.js";
import type { ClientStore } from "./projection.js";

export function createMemberActions(api: Api, store: ClientStore) {
  const routes = api.api.organizations[":organizationId"].members;
  return {
    load: async (organizationId: string) => {
      await commit(
        store,
        routes.$get({ param: { organizationId } }),
        (members: Membership[]) => ({
          type: "members-loaded",
          organizationId,
          members,
        }),
      );
    },
    put: async (organizationId: string, input: MembershipInput) => {
      await commit(
        store,
        routes.$put({ param: { organizationId }, json: input }),
        (membership: Membership) => ({
          type: "membership-put",
          organizationId,
          membership,
        }),
      );
    },
  };
}
