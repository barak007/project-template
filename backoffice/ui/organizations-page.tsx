import { useEffect } from "react";

import { visibleOrganizations } from "../client/index.js";
import type { BackofficeCore } from "../client/index.js";

import { useBackofficeState } from "./use-backoffice-state.js";

export function OrganizationsPage({
  core,
  load,
  onOpen,
}: {
  core: BackofficeCore;
  load: (action: () => Promise<void>) => Promise<void>;
  onOpen: (organizationId: string) => void;
}) {
  const page = useBackofficeState(core, (state) => state.organizationsPage);
  const organizations = useBackofficeState(core, visibleOrganizations);

  useEffect(() => {
    void load(() => core.admin.loadOrganizations());
  }, [core, load]);

  const create = () => void load(() => core.admin.createOrganization());

  const remove = (organization: { id: string; name: string }) => {
    if (
      !window.confirm(
        `Delete organization "${organization.name}" and everything in it (members, sources, workspaces, work sessions)? This cannot be undone.`,
      )
    )
      return;
    void load(() => core.admin.deleteOrganization(organization.id));
  };

  return (
    <section>
      <h1>Organizations</h1>
      {page.error ? <p className="error">{page.error.message}</p> : null}
      <div className="editor-actions">
        <input
          placeholder="New organization name"
          value={page.draftName}
          onChange={(event) => {
            core.admin.setOrganizationDraft(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && page.draftName.trim()) create();
          }}
        />
        <button
          className="primary"
          disabled={!page.draftName.trim()}
          onClick={create}
        >
          Add organization
        </button>
      </div>
      <input
        type="search"
        placeholder="Filter by name"
        value={page.filter}
        onChange={(event) => {
          core.admin.setOrganizationsFilter(event.target.value);
        }}
      />
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Created</th>
              <th className="actions" />
            </tr>
          </thead>
          <tbody>
            {organizations.map((organization) => (
              <tr key={organization.id}>
                <td title={organization.id}>
                  <code>{organization.id}</code>
                </td>
                <td title={organization.name}>{organization.name}</td>
                <td>{new Date(organization.createdAt).toLocaleString()}</td>
                <td className="row-actions">
                  <button onClick={() => onOpen(organization.id)}>Open</button>
                  <button
                    className="danger"
                    onClick={() => {
                      remove(organization);
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
