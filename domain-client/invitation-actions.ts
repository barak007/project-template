import type { Api, InvitationInput } from "./api.js";
import { toApiError } from "./errors.js";
import type { ClientStore } from "./projection.js";

/**
 * Inviting people to an organization, from the inviting side. An invitation
 * grants nothing on its own — it is an offer to an email address, and the
 * membership appears only once the invited person accepts it from their own
 * inbox (inbox-actions.ts).
 */
export function createInvitationActions(api: Api, store: ClientStore) {
  const routes = api.api.organizations[":organizationId"].invitations;
  return {
    load: async (organizationId: string) => {
      const response = await routes.$get({ param: { organizationId } });
      if (!response.ok) throw await toApiError(response);
      store.dispatch({
        type: "invitations-loaded",
        organizationId,
        invitations: await response.json(),
      });
    },
    invite: async (organizationId: string, input: InvitationInput) => {
      const response = await routes.$post({
        param: { organizationId },
        json: input,
      });
      if (!response.ok) throw await toApiError(response);
      store.dispatch({
        type: "invitation-sent",
        organizationId,
        invitation: await response.json(),
      });
    },
    revoke: async (organizationId: string, invitationId: string) => {
      const response = await routes[":invitationId"].$delete({
        param: { organizationId, invitationId },
      });
      if (!response.ok) throw await toApiError(response);
      store.dispatch({
        type: "invitation-revoked",
        organizationId,
        invitation: await response.json(),
      });
    },
  };
}
