import {
  actionKeys,
  confirmKeys,
  hasLoaded,
  isPending,
  loadKeys,
} from "../client/index.js";
import type { AppCore, Membership, WorkspaceRole } from "../client/index.js";

import { ConfirmButton } from "./confirm-button.js";
import { EntityIcon } from "./entity-icon.js";
import { RouteLink } from "./route-link.js";
import { Section } from "./section.js";
import { Skeleton } from "./skeleton.js";
import { useAppState } from "./use-app-state.js";

const roles: WorkspaceRole[] = ["viewer", "operator", "editor", "manager"];

/** What each role is for, in the words of the job rather than the permission. */
const explains: Record<WorkspaceRole, string> = {
  viewer: "can look at it",
  operator: "can open sessions",
  editor: "can change its repositories",
  manager: "can change who reaches it",
};

/**
 * Who may reach this workspace. Two levers, and they are different questions:
 * **visibility** decides whether the organization at large sees it at all, and a
 * **grant** names one person and what they may do.
 *
 * Only its manager sees this section — an organization's owners and admins
 * manage every workspace, and a member manages what they created. Grants only
 * ever add: this is how somebody is let in, never how they are locked out.
 */
export function WorkspaceAccessSection({
  core,
  organizationId,
  workspaceId,
  visibility,
}: {
  core: AppCore;
  organizationId: string;
  workspaceId: string;
  visibility: "organization" | "restricted";
}) {
  const grants = useAppState(core, (state) => state.workspaceGrants.grants);
  const forThis = useAppState(
    core,
    (state) => state.workspaceGrants.workspaceId === workspaceId,
  );
  const loaded = useAppState(core, (state) =>
    hasLoaded(state, loadKeys.workspaceGrants(workspaceId)),
  );
  const changingVisibility = useAppState(core, (state) =>
    isPending(state, actionKeys.setVisibility(workspaceId)),
  );
  const restricted = visibility === "restricted";

  return (
    <Section
      title="Access"
      note={
        restricted
          ? `${String(forThis ? grants.length : 0)} with access`
          : "everyone in this organization"
      }
      action={
        <button
          type="button"
          className="ghost small"
          disabled={changingVisibility}
          aria-busy={changingVisibility}
          onClick={() => {
            void core.workspaceAccess.setVisibility(
              organizationId,
              workspaceId,
              restricted ? "organization" : "restricted",
            );
          }}
        >
          {changingVisibility
            ? "Working…"
            : restricted
              ? "Open to the organization"
              : "Restrict to named people"}
        </button>
      }
    >
      {/* What the current setting means, before the list of exceptions to it:
          an organization-visible workspace still has grants, and they still
          matter — they are what raises somebody above looking. */}
      <div className="project-row for-organization">
        <EntityIcon entity="organization" />
        <span className="muted">
          {restricted
            ? "Only the people below, and the organization’s owners and admins."
            : "Everyone in this organization can open this workspace."}
        </span>
        <RouteLink
          core={core}
          to={{ kind: "organization", organizationId }}
          className="link"
        >
          Members
        </RouteLink>
      </div>

      {!loaded || !forThis ? (
        <Skeleton rows={1} />
      ) : grants.length === 0 ? (
        <div className="empty">
          <p>
            Nobody has been named yet.
            {restricted
              ? " Nobody outside the organization’s owners and admins can reach this."
              : " Naming someone gives them more than a look."}
          </p>
          <GrantForm
            core={core}
            organizationId={organizationId}
            workspaceId={workspaceId}
          />
        </div>
      ) : (
        <>
          <ul className="rows">
            {grants.map((grant) => (
              <li key={grant.userId}>
                <div className="row-main">
                  <strong>{grant.name || grant.email}</strong>
                  <span className="muted">{grant.email}</span>
                  <span className="row-meta">{explains[grant.role]}</span>
                </div>
                <div className="row-actions">
                  <RolePicker
                    core={core}
                    organizationId={organizationId}
                    workspaceId={workspaceId}
                    userId={grant.userId}
                    role={grant.role}
                  />
                  <ConfirmButton
                    core={core}
                    confirmKey={confirmKeys.removeGrant(grant.userId)}
                    actionKey={actionKeys.removeGrant(grant.userId)}
                    label="Remove"
                    question={`Take away ${grant.name || grant.email}’s access?`}
                    onConfirm={() => {
                      void core.workspaceAccess.removeGrant(
                        organizationId,
                        workspaceId,
                        grant.userId,
                      );
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <GrantForm
            core={core}
            organizationId={organizationId}
            workspaceId={workspaceId}
          />
        </>
      )}
    </Section>
  );
}

/**
 * Giving somebody access. A picker over the organization's members rather than a
 * free-text field: access is only grantable to people who are already in the
 * organization, so anything typed here could only be wrong.
 */
function GrantForm({
  core,
  organizationId,
  workspaceId,
}: {
  core: AppCore;
  organizationId: string;
  workspaceId: string;
}) {
  const draft = useAppState(core, (state) => state.grantDraft);
  const members = useAppState(core, (state) => state.members);
  const grants = useAppState(core, (state) => state.workspaceGrants.grants);
  const pending = useAppState(core, (state) =>
    isPending(state, actionKeys.grantAccess),
  );

  // Somebody who already has a grant is changed on their row, not added twice.
  const granted = new Set(grants.map((grant) => grant.userId));
  const candidates = members.filter((member) => !granted.has(member.userId));
  if (candidates.length === 0)
    return (
      <p className="muted">
        Everyone in this organization has been named. Invite someone else to
        share it with them.
      </p>
    );

  return (
    <form
      className="create-form"
      onSubmit={(event) => {
        event.preventDefault();
        void core.workspaceAccess.grant(organizationId, workspaceId);
      }}
    >
      <label>
        Give access to
        <select
          value={draft.userId}
          disabled={pending}
          onChange={(event) => {
            core.workspaceAccess.changeDraft({ userId: event.target.value });
          }}
        >
          <option value="">Choose a member…</option>
          {candidates.map((member) => (
            <option key={member.userId} value={member.userId}>
              {label(member)}
            </option>
          ))}
        </select>
      </label>
      <label>
        As
        <select
          value={draft.role}
          disabled={pending}
          onChange={(event) => {
            core.workspaceAccess.changeDraft({
              role: event.target.value as WorkspaceRole,
            });
          }}
        >
          {roles.map((role) => (
            <option key={role} value={role}>
              {role} — {explains[role]}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={draft.userId === "" || pending}
        aria-busy={pending}
      >
        {pending ? "Working…" : "Give access"}
      </button>
    </form>
  );
}

function RolePicker({
  core,
  organizationId,
  workspaceId,
  userId,
  role,
}: {
  core: AppCore;
  organizationId: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
}) {
  const pending = useAppState(core, (state) =>
    isPending(state, actionKeys.changeGrant(userId)),
  );
  return (
    <label aria-label={`Access for ${userId}`}>
      <select
        className="small"
        value={role}
        disabled={pending}
        onChange={(event) => {
          void core.workspaceAccess.changeGrant(
            organizationId,
            workspaceId,
            userId,
            event.target.value as WorkspaceRole,
          );
        }}
      >
        {roles.map((each) => (
          <option key={each} value={each}>
            {each}
          </option>
        ))}
      </select>
    </label>
  );
}

function label(member: Membership): string {
  return member.name ? `${member.name} (${member.email})` : member.email;
}
