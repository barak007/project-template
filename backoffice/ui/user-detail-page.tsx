import { useEffect } from "react";

import type { BackofficeCore } from "../client/index.js";

import { useBackofficeState } from "./use-backoffice-state.js";

export function UserDetailPage({
  core,
  load,
  userId,
  onBack,
  onOpenOrganization,
}: {
  core: BackofficeCore;
  load: (action: () => Promise<void>) => Promise<void>;
  userId: string;
  onBack: () => void;
  onOpenOrganization: (organizationId: string) => void;
}) {
  const detail = useBackofficeState(core, (state) => state.userDetail);

  useEffect(() => {
    void load(() => core.admin.loadUserDetail(userId));
  }, [core, load, userId]);

  if (detail?.user.id !== userId) return <p>Loading…</p>;

  return (
    <section className="detail-page">
      <button onClick={onBack}>← Users</button>
      <h1>{detail.user.name}</h1>
      <p className="detail-meta">
        <code>{detail.user.id}</code> · {detail.user.email} ·{" "}
        {detail.user.emailVerified ? "verified" : "not verified"} · joined{" "}
        {new Date(detail.user.createdAt).toLocaleString()}
      </p>

      <h2>Sign-in methods</h2>
      <table>
        <thead>
          <tr>
            <th>Provider</th>
            <th>Created</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {detail.accounts.map((entry) => (
            <tr key={entry.id}>
              <td>
                {entry.providerId === "credential"
                  ? "credential (email + password)"
                  : entry.providerId}
              </td>
              <td>{new Date(entry.createdAt).toLocaleString()}</td>
              <td>{new Date(entry.updatedAt).toLocaleString()}</td>
            </tr>
          ))}
          {detail.accounts.length === 0 ? (
            <tr>
              <td className="empty" colSpan={3}>
                No sign-in methods.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <h2>Organizations</h2>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Role</th>
            <th>Joined</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {detail.memberships.map((membership) => (
            <tr key={membership.organizationId}>
              <td>{membership.organizationName}</td>
              <td>{membership.role}</td>
              <td>{new Date(membership.createdAt).toLocaleString()}</td>
              <td>
                <button
                  onClick={() => {
                    onOpenOrganization(membership.organizationId);
                  }}
                >
                  Open
                </button>
              </td>
            </tr>
          ))}
          {detail.memberships.length === 0 ? (
            <tr>
              <td className="empty" colSpan={4}>
                No memberships.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <h2>Sessions</h2>
      <table>
        <thead>
          <tr>
            <th>Created</th>
            <th>Expires</th>
            <th>IP</th>
            <th>Agent</th>
          </tr>
        </thead>
        <tbody>
          {detail.sessions.map((entry) => (
            <tr key={entry.id}>
              <td>{new Date(entry.createdAt).toLocaleString()}</td>
              <td>{new Date(entry.expiresAt).toLocaleString()}</td>
              <td>{entry.ipAddress ?? "—"}</td>
              <td>{entry.userAgent ?? "—"}</td>
            </tr>
          ))}
          {detail.sessions.length === 0 ? (
            <tr>
              <td className="empty" colSpan={4}>
                No sessions.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <h2>Work sessions created</h2>
      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th>Failure</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {detail.workSessions.map((workSession) => (
            <tr key={workSession.id}>
              <td>
                <span className={`status status-${workSession.status}`}>
                  {workSession.status}
                </span>
              </td>
              <td>{workSession.failureCode ?? "—"}</td>
              <td>{new Date(workSession.createdAt).toLocaleString()}</td>
            </tr>
          ))}
          {detail.workSessions.length === 0 ? (
            <tr>
              <td className="empty" colSpan={3}>
                None. This user can be deleted.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      {detail.workSessions.length > 0 ? (
        <p className="hint">
          Work sessions block deletion of this user (on delete restrict).
        </p>
      ) : null}
    </section>
  );
}
