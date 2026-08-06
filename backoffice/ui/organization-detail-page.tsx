import { useEffect } from "react";

import type { BackofficeCore } from "../core/index.js";

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

  if (detail?.organization.id !== organizationId) return <p>Loading…</p>;

  return (
    <section>
      <button onClick={onBack}>← Organizations</button>
      <h1>{detail.organization.name}</h1>

      <h2>Members</h2>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Joined</th>
          </tr>
        </thead>
        <tbody>
          {detail.members.map((member) => (
            <tr key={member.userId}>
              <td>{member.name}</td>
              <td>{member.email}</td>
              <td>{member.role}</td>
              <td>{new Date(member.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Sources</h2>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Kind</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {detail.sources.map((source) => (
            <tr key={source.id}>
              <td>{source.name}</td>
              <td>{source.kind}</td>
              <td>{new Date(source.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Workspaces</h2>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {detail.workspaces.map((workspace) => (
            <tr key={workspace.id}>
              <td>{workspace.name}</td>
              <td>{new Date(workspace.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Work sessions</h2>
      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th>Failure</th>
            <th>Created by</th>
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
              <td>{workSession.createdByUserId}</td>
              <td>{new Date(workSession.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
