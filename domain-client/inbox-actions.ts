import type { Api, InvitationDecision } from "./api.js";
import { toApiError } from "./errors.js";
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
      const response = await api.api.me.messages.$get();
      if (!response.ok) throw await toApiError(response);
      store.dispatch({ type: "inbox-loaded", messages: await response.json() });
    },
    respond: async (invitationId: string, decision: InvitationDecision) => {
      const response = await api.api.me.invitations[
        ":invitationId"
      ].response.$post({ param: { invitationId }, json: { decision } });
      if (!response.ok) throw await toApiError(response);
      store.dispatch({
        type: "invitation-answered",
        invitation: await response.json(),
      });
    },
  };
}
