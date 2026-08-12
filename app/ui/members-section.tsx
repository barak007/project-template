import { actionKeys, hasLoaded, isPending, loadKeys } from "../client/index.js";
import type { AppCore, Membership } from "../client/index.js";

import { Section } from "./section.js";
import { Skeleton } from "./skeleton.js";
import { useAppState } from "./use-app-state.js";

const roles: Membership["role"][] = ["owner", "admin", "member"];

/**
 * Who belongs to this organization. Membership is the app's only access control:
 * a workspace has no members of its own, so everyone in this list can reach
 * everything inside the organization — which is why this belongs on the
 * organization's page and nowhere else.
 *
 * Nobody is added here: joining is an invitation the invited person accepts
 * ([invitations-section.tsx](./invitations-section.tsx)), so this list only ever
 * changes what an existing member's role is.
 *
 * The server's membership is `{ userId, role }` and nothing more, so a row can
 * name a role but not a person: there is no name or email to show. That needs
 * the API to grow, not this component.
 */
export function MembersSection({
  core,
  organizationId,
}: {
  core: AppCore;
  organizationId: string;
}) {
  const members = useAppState(core, (state) => state.members);
  const auth = useAppState(core, (state) => state.auth);
  const loaded = useAppState(core, (state) =>
    hasLoaded(state, loadKeys.members(organizationId)),
  );
  const signedInUserId = auth.status === "authenticated" ? auth.user.id : null;

  return (
    <Section
      title="Members"
      note={
        loaded
          ? `${String(members.length)} with access to everything in this organization`
          : undefined
      }
    >
      {!loaded ? (
        <Skeleton rows={2} />
      ) : members.length === 0 ? (
        <div className="empty">
          <p>No members to show.</p>
        </div>
      ) : (
        <ul className="rows">
          {members.map((member) => (
            <li key={member.userId}>
              <div className="row-main">
                <strong>
                  {member.userId === signedInUserId ? "You" : "Member"}
                </strong>
                <span className="muted">
                  <code>{member.userId}</code>
                </span>
                <span className="row-meta">
                  joined {new Date(member.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="row-actions">
                <RolePicker
                  core={core}
                  organizationId={organizationId}
                  member={member}
                  // Demoting yourself is how an organization ends up with nobody
                  // who can administer it; that needs someone else to do it.
                  fixed={member.userId === signedInUserId}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function RolePicker({
  core,
  organizationId,
  member,
  fixed,
}: {
  core: AppCore;
  organizationId: string;
  member: Membership;
  fixed: boolean;
}) {
  const pending = useAppState(core, (state) =>
    isPending(state, actionKeys.changeRole(member.userId)),
  );
  if (fixed) return <span className="muted">{member.role}</span>;
  return (
    <label aria-label={`Role for ${member.userId}`}>
      <select
        className="small"
        value={member.role}
        disabled={pending}
        onChange={(event) => {
          void core.members.changeRole(
            organizationId,
            member.userId,
            event.target.value as Membership["role"],
          );
        }}
      >
        {roles.map((role) => (
          <option key={role} value={role}>
            {role}
          </option>
        ))}
      </select>
    </label>
  );
}
