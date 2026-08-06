import { useEffect, useState } from "react";

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
  const organizations = useBackofficeState(
    core,
    (state) => state.organizations,
  );
  const [filter, setFilter] = useState("");

  useEffect(() => {
    void load(() => core.admin.loadOrganizations());
  }, [core, load]);

  const query = filter.trim().toLowerCase();
  const visible = query
    ? organizations.filter((organization) =>
        organization.name.toLowerCase().includes(query),
      )
    : organizations;

  return (
    <section>
      <h1>Organizations</h1>
      <input
        type="search"
        placeholder="Filter by name"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
      />
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Created</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {visible.map((organization) => (
            <tr key={organization.id}>
              <td>{organization.name}</td>
              <td>{new Date(organization.createdAt).toLocaleString()}</td>
              <td>
                <button onClick={() => onOpen(organization.id)}>Open</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
