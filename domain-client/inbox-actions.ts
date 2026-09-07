import type {
  Api,
  Invitation,
  InvitationDecision,
  UserMessage,
} from "./api.js";
import { commit } from "./commit.js";
import type { ClientStore } from "./projection.js";

/**
 * What is waiting for the signed-in user personally, and their answer to it.
 * The inbox is identity-scoped, not organization-scoped: an invitation arrives
 * from an organization the user cannot see yet, which is the whole point —
 * accepting is what gives them access, so accepting reloads their organizations.
 */
export function createInboxActions(api: Api, store: ClientStore) {
  return {
    load: async () => {
      await commit(
        store,
        api.api.me.messages.$get(),
        (messages: UserMessage[]) => ({
          type: "inbox-loaded",
          messages,
        }),
      );
    },
    respond: async (invitationId: string, decision: InvitationDecision) => {
      await commit(
        store,
        api.api.me.invitations[":invitationId"].response.$post({
          param: { invitationId },
          json: { decision },
        }),
        (invitation: Invitation) => ({
          type: "invitation-answered",
          invitation,
        }),
      );
    },
  };
}
