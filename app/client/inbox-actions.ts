import type { InvitationDecision } from "../../domain-client/index.js";

import type { AppActionContext } from "./context.js";
import { actionKeys, loadKeys } from "./keys.js";

/**
 * The signed-in user's own inbox — what other people have addressed to them.
 * Accepting an invitation is what creates the membership, so it also reloads
 * the organizations: the one just joined has to appear on the dashboard the
 * user is looking at.
 */
export function createInboxActions({ client, attempt }: AppActionContext) {
  return {
    load: () => attempt(() => client.inbox.load(), { loaded: loadKeys.inbox }),
    respond: (invitationId: string, decision: InvitationDecision) =>
      attempt(
        async () => {
          await client.inbox.respond(invitationId, decision);
          if (decision === "accept") await client.organizations.load();
        },
        { key: actionKeys.answerInvitation(invitationId) },
      ),
  };
}
