import { useEffect } from "react";

import type { BackofficeCore } from "../client/index.js";

import { DetailTable } from "./detail-table.js";
import { Loading } from "./loading.js";
import { StatusPill } from "./status-pill.js";
import { useBackofficeState } from "./use-backoffice-state.js";

export function OrganizationDetailPage({
  core,
  load,
  organizationId,
  onBack,
}: {
  core: BackofficeCore;
  load: (action: () => Promise<void>) => Promise<void>;
  organizationId: string;
  onBack: () => void;
}) {
  const detail = useBackofficeState(core, (state) => state.organizationDetail);

  useEffect(() => {
    void load(() => core.admin.loadOrganizationDetail(organizationId));
  }, [core, load, organizationId]);

  if (detail?.organization.id !== organizationId) return <Loading />;

  return (
    <section className="detail-page">
      <button onClick={onBack}>← Organizations</button>
      <h1>{detail.organization.name}</h1>

      <h2>Members</h2>
      <DetailTable
        columns={["Name", "Email", "Role", "Joined"]}
        rows={detail.members}
        rowKey={(member) => member.userId}
        cells={(member) => [
          member.name,
          member.email,
          member.role,
          new Date(member.createdAt).toLocaleString(),
        ]}
        emptyMessage="No members."
      />

      <h2>Sources</h2>
      <DetailTable
        columns={["Name", "Kind", "Created"]}
        rows={detail.sources}
        rowKey={(source) => source.id}
        cells={(source) => [
          source.name,
          source.kind,
          new Date(source.createdAt).toLocaleString(),
        ]}
        emptyMessage="No sources."
      />

      <h2>Workspaces</h2>
      <DetailTable
        columns={["Name", "Created"]}
        rows={detail.workspaces}
        rowKey={(workspace) => workspace.id}
        cells={(workspace) => [
          workspace.name,
          new Date(workspace.createdAt).toLocaleString(),
        ]}
        emptyMessage="No workspaces."
      />

      <h2>Work sessions</h2>
      <DetailTable
        columns={["Status", "Failure", "Created by", "Created"]}
        rows={detail.workSessions}
        rowKey={(workSession) => workSession.id}
        cells={(workSession) => [
          <StatusPill status={workSession.status} />,
          workSession.failureCode ?? "—",
          workSession.createdByUserId,
          new Date(workSession.createdAt).toLocaleString(),
        ]}
        emptyMessage="No work sessions."
      />
    </section>
  );
}
