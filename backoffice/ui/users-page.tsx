import { useEffect, useState } from "react";

import type { BackofficeCore } from "../client/index.js";

import { useBackofficeState } from "./use-backoffice-state.js";

export function UsersPage({
  core,
  load,
}: {
  core: BackofficeCore;
  load: (action: () => Promise<void>) => Promise<void>;
}) {
  const users = useBackofficeState(core, (state) => state.users);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    void load(() => core.admin.loadUsers());
  }, [core, load]);

  const query = filter.trim().toLowerCase();
  const visible = query
    ? users.filter(
        (user) =>
          user.name.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query),
      )
    : users;

  return (
    <section>
      <h1>Users</h1>
      <input
        type="search"
        placeholder="Filter by name or email"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
      />
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Verified</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((user) => (
            <tr key={user.id}>
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td>{user.emailVerified ? "yes" : "no"}</td>
              <td>{new Date(user.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
