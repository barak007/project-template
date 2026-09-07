import type { Api, Invitation, InvitationInput } from "./api.js";
import { commit } from "./commit.js";
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
      await commit(
        store,
        routes.$get({ param: { organizationId } }),
        (invitations: Invitation[]) => ({
          type: "invitations-loaded",
          organizationId,
          invitations,
        }),
      );
    },
    invite: async (organizationId: string, input: InvitationInput) => {
      await commit(
        store,
        routes.$post({ param: { organizationId }, json: input }),
        (invitation: Invitation) => ({
          type: "invitation-sent",
          organizationId,
          invitation,
        }),
      );
    },
    revoke: async (organizationId: string, invitationId: string) => {
      await commit(
        store,
        routes[":invitationId"].$delete({
          param: { organizationId, invitationId },
        }),
        (invitation: Invitation) => ({
          type: "invitation-revoked",
          organizationId,
          invitation,
        }),
      );
    },
  };
}
