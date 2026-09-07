import { useEffect } from "react";

import type { BackofficeCore } from "../client/index.js";

import { DetailTable } from "./detail-table.js";
import { Loading } from "./loading.js";
import { StatusPill } from "./status-pill.js";
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

  if (detail?.user.id !== userId) return <Loading />;

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
      <DetailTable
        columns={["Provider", "Created", "Updated"]}
        rows={detail.accounts}
        rowKey={(entry) => entry.id}
        cells={(entry) => [
          entry.providerId === "credential"
            ? "credential (email + password)"
            : entry.providerId,
          new Date(entry.createdAt).toLocaleString(),
          new Date(entry.updatedAt).toLocaleString(),
        ]}
        emptyMessage="No sign-in methods."
      />

      <h2>Organizations</h2>
      <DetailTable
        columns={["Name", "Role", "Joined", ""]}
        rows={detail.memberships}
        rowKey={(membership) => membership.organizationId}
        cells={(membership) => [
          membership.organizationName,
          membership.role,
          new Date(membership.createdAt).toLocaleString(),
          <button
            onClick={() => {
              onOpenOrganization(membership.organizationId);
            }}
          >
            Open
          </button>,
        ]}
        emptyMessage="No memberships."
      />

      <h2>Sessions</h2>
      <DetailTable
        columns={["Created", "Expires", "IP", "Agent"]}
        rows={detail.sessions}
        rowKey={(entry) => entry.id}
        cells={(entry) => [
          new Date(entry.createdAt).toLocaleString(),
          new Date(entry.expiresAt).toLocaleString(),
          entry.ipAddress ?? "—",
          entry.userAgent ?? "—",
        ]}
        emptyMessage="No sessions."
      />

      <h2>Work sessions created</h2>
      <DetailTable
        columns={["Status", "Failure", "Created"]}
        rows={detail.workSessions}
        rowKey={(workSession) => workSession.id}
        cells={(workSession) => [
          <StatusPill status={workSession.status} />,
          workSession.failureCode ?? "—",
          new Date(workSession.createdAt).toLocaleString(),
        ]}
        emptyMessage="None. This user can be deleted."
      />
      {detail.workSessions.length > 0 ? (
        <p className="hint">
          Work sessions block deletion of this user (on delete restrict).
        </p>
      ) : null}
    </section>
  );
}
