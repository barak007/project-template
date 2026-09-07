import type { AppActionContext } from "./context.js";
import { createDraftForm } from "./draft-form.js";
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
  const form = createDraftForm(store, {
    form: "invitation",
    changed: (draft: Partial<InviteDraft>) => ({
      type: "invite-draft-changed",
      draft,
    }),
    empty: emptyInviteDraft,
  });

  return {
    load: (organizationId: string) =>
      attempt(() => client.invitations.load(organizationId), {
        loaded: loadKeys.invitations(organizationId),
      }),
    changeDraft: form.change,
    startInviting: form.open,
    cancelInviting: form.cancel,
    invite: (organizationId: string) =>
      attempt(
        async () => {
          const { email, role } = store.getState().inviteDraft;
          if (email.trim().length === 0) return;
          await client.invitations.invite(organizationId, {
            email: email.trim(),
            role,
          });
          form.finish();
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
