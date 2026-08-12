import {
  actionKeys,
  confirmKeys,
  hasLoaded,
  isPending,
  loadKeys,
} from "../client/index.js";
import type { AppCore, Invitation, Membership } from "../client/index.js";

import { ConfirmButton } from "./confirm-button.js";
import { Section } from "./section.js";
import { Skeleton } from "./skeleton.js";
import { useAppState } from "./use-app-state.js";

const roles: Membership["role"][] = ["owner", "admin", "member"];

/**
 * Inviting people in, and what has been offered so far. An invitation is
 * addressed to an email — the one thing an administrator actually knows about
 * someone — and it grants nothing: the person it was sent to finds it in their
 * inbox and decides, so a mistyped address cannot let anyone in.
 */
export function InvitationsSection({
  core,
  organizationId,
}: {
  core: AppCore;
  organizationId: string;
}) {
  const invitations = useAppState(core, (state) => state.invitations);
  const loaded = useAppState(core, (state) =>
    hasLoaded(state, loadKeys.invitations(organizationId)),
  );
  const inviting = useAppState(
    core,
    (state) => state.openForm === "invitation",
  );

  // Answered invitations are history, not work: the section is about who has
  // been offered access and has not replied.
  const waiting = invitations.filter(
    (invitation) => invitation.status === "pending",
  );

  const form = <InviteForm core={core} organizationId={organizationId} />;

  return (
    <Section
      title="Invitations"
      note={
        loaded && waiting.length > 0
          ? `${String(waiting.length)} waiting to be accepted`
          : undefined
      }
      action={
        waiting.length > 0 && !inviting ? (
          <button
            type="button"
            className="ghost small"
            onClick={() => {
              core.invitations.startInviting();
            }}
          >
            Invite someone
          </button>
        ) : undefined
      }
    >
      {inviting && waiting.length > 0 ? form : null}
      {!loaded ? (
        <Skeleton rows={1} />
      ) : waiting.length === 0 ? (
        <div className="empty">
          <p>
            Nobody is waiting. Invite someone by email — they join once they
            accept, so nothing changes here until they do.
          </p>
          {form}
        </div>
      ) : (
        <ul className="rows">
          {waiting.map((invitation) => (
            <li key={invitation.id}>
              <div className="row-main">
                <strong>{invitation.email}</strong>
                <span className="muted">as {invitation.role}</span>
                <span className="row-meta">
                  invited {new Date(invitation.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="row-actions">
                <ConfirmButton
                  core={core}
                  confirmKey={confirmKeys.revokeInvitation(invitation.id)}
                  actionKey={actionKeys.revokeInvitation(invitation.id)}
                  label="Revoke"
                  question={`Withdraw the invitation to ${invitation.email}?`}
                  onConfirm={() => {
                    void core.invitations.revoke(organizationId, invitation.id);
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      <AnsweredNote invitations={invitations} loaded={loaded} />
    </Section>
  );
}

/**
 * Two fields rather than one, so this is its own form rather than a
 * `CreateForm`: what someone is invited as is part of inviting them, not a
 * second step afterwards.
 */
function InviteForm({
  core,
  organizationId,
}: {
  core: AppCore;
  organizationId: string;
}) {
  const draft = useAppState(core, (state) => state.inviteDraft);
  const pending = useAppState(core, (state) =>
    isPending(state, actionKeys.invite),
  );

  return (
    <form
      className="create-form"
      onSubmit={(event) => {
        event.preventDefault();
        void core.invitations.invite(organizationId);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        core.invitations.cancelInviting();
      }}
    >
      <label>
        Email address
        <input
          type="email"
          value={draft.email}
          placeholder="grace@example.com"
          disabled={pending}
          autoFocus
          onChange={(event) => {
            core.invitations.changeDraft({ email: event.target.value });
          }}
        />
      </label>
      <label>
        Role
        <select
          value={draft.role}
          disabled={pending}
          onChange={(event) => {
            core.invitations.changeDraft({
              role: event.target.value as Membership["role"],
            });
          }}
        >
          {roles.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={draft.email.trim() === "" || pending}
        aria-busy={pending}
      >
        {pending ? "Sending…" : "Send invitation"}
      </button>
      <button
        type="button"
        className="ghost"
        onClick={() => {
          core.invitations.cancelInviting();
        }}
      >
        Cancel
      </button>
    </form>
  );
}

/** What became of the rest, as one line rather than a second list. */
function AnsweredNote({
  invitations,
  loaded,
}: {
  invitations: Invitation[];
  loaded: boolean;
}) {
  const accepted = invitations.filter(
    (invitation) => invitation.status === "accepted",
  ).length;
  const refused = invitations.filter(
    (invitation) =>
      invitation.status === "declined" || invitation.status === "revoked",
  ).length;
  if (!loaded || accepted + refused === 0) return null;
  return (
    <p className="muted">
      {accepted > 0 ? `${String(accepted)} accepted` : null}
      {accepted > 0 && refused > 0 ? " · " : null}
      {refused > 0 ? `${String(refused)} declined or withdrawn` : null}
    </p>
  );
}
