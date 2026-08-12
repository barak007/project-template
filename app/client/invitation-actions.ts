import type { AppActionContext } from "./context.js";
import { actionKeys, loadKeys } from "./keys.js";
import { emptyInviteDraft } from "./state.js";
import type { InviteDraft } from "./state.js";

/**
 * Inviting people into an organization. The address is what an administrator
 * knows about someone — not their user id — and the invitation grants nothing
 * until they accept it from their own inbox (inbox-actions.ts), so this page
 * can only ever offer access, never hand it out.
 */
export function createInvitationActions({
  client,
  store,
  attempt,
}: AppActionContext) {
  const clearDraft = () => {
    store.dispatch({ type: "invite-draft-changed", draft: emptyInviteDraft });
  };

  return {
    load: (organizationId: string) =>
      attempt(() => client.invitations.load(organizationId), {
        loaded: loadKeys.invitations(organizationId),
      }),
    changeDraft: (draft: Partial<InviteDraft>) => {
      store.dispatch({ type: "invite-draft-changed", draft });
    },
    startInviting: () => {
      store.dispatch({ type: "create-form-opened", form: "invitation" });
    },
    cancelInviting: () => {
      store.dispatch({ type: "create-form-closed" });
      clearDraft();
    },
    invite: (organizationId: string) =>
      attempt(
        async () => {
          const { email, role } = store.getState().inviteDraft;
          if (email.trim().length === 0) return;
          await client.invitations.invite(organizationId, {
            email: email.trim(),
            role,
          });
          clearDraft();
          store.dispatch({ type: "create-form-closed" });
        },
        { key: actionKeys.invite },
      ),
    /** Taking back an offer nobody has answered; the row arms first. */
    revoke: (organizationId: string, invitationId: string) =>
      attempt(() => client.invitations.revoke(organizationId, invitationId), {
        key: actionKeys.revokeInvitation(invitationId),
      }),
  };
}
