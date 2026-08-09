import { useEffect } from "react";

import { visibleUsers } from "../client/index.js";
import type { BackofficeCore } from "../client/index.js";

import { useBackofficeState } from "./use-backoffice-state.js";

export function UsersPage({
  core,
  load,
  onOpen,
}: {
  core: BackofficeCore;
  load: (action: () => Promise<void>) => Promise<void>;
  onOpen: (userId: string) => void;
}) {
  const page = useBackofficeState(core, (state) => state.usersPage);
  const users = useBackofficeState(core, visibleUsers);

  useEffect(() => {
    void load(() => core.admin.loadUsers());
  }, [core, load]);

  const remove = (user: { id: string; email: string }) => {
    if (!window.confirm(`Delete user ${user.email}? This cannot be undone.`))
      return;
    void load(() => core.admin.deleteUser(user.id));
  };

  return (
    <section>
      <header className="table-header">
        <h1>Users</h1>
        <span className="spacer" />
        <button
          onClick={() => {
            if (page.editorOpen) core.admin.closeUserEditor();
            else core.admin.openUserEditor();
          }}
        >
          {page.editorOpen ? "Cancel" : "Add user"}
        </button>
      </header>
      {page.error ? <p className="error">{page.error.message}</p> : null}
      {page.editorOpen ? (
        <div className="row-editor">
          <h2>Add user</h2>
          <div className="fields">
            <label>
              <span>name *</span>
              <input
                value={page.draft.name}
                onChange={(event) => {
                  core.admin.setUserDraft({ name: event.target.value });
                }}
              />
            </label>
            <label>
              <span>email *</span>
              <input
                type="email"
                value={page.draft.email}
                onChange={(event) => {
                  core.admin.setUserDraft({ email: event.target.value });
                }}
              />
            </label>
            <label>
              <span>password * (min 8 characters)</span>
              <input
                type="password"
                value={page.draft.password}
                onChange={(event) => {
                  core.admin.setUserDraft({ password: event.target.value });
                }}
              />
            </label>
          </div>
          <div className="editor-actions">
            <button
              className="primary"
              onClick={() => void load(() => core.admin.createUser())}
            >
              Create
            </button>
          </div>
        </div>
      ) : null}
      <input
        type="search"
        placeholder="Filter by name or email"
        value={page.filter}
        onChange={(event) => {
          core.admin.setUsersFilter(event.target.value);
        }}
      />
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Verified</th>
              <th>Created</th>
              <th className="actions" />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td title={user.id}>
                  <code>{user.id}</code>
                </td>
                <td title={user.name}>{user.name}</td>
                <td title={user.email}>{user.email}</td>
                <td>{user.emailVerified ? "yes" : "no"}</td>
                <td>{new Date(user.createdAt).toLocaleString()}</td>
                <td className="row-actions">
                  <button
                    onClick={() => {
                      onOpen(user.id);
                    }}
                  >
                    Open
                  </button>
                  <button
                    className="danger"
                    onClick={() => {
                      remove(user);
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
