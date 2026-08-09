import { useEffect } from "react";

import type { BackofficeCore, RowFilter, TableRow } from "../client/index.js";

import { rowText, TablePage } from "./table-page.js";
import { useBackofficeState } from "./use-backoffice-state.js";

/**
 * The generic row editor cannot create a user: the password is hashed into
 * a credential account row alongside the user. This editor drives that
 * admin flow; the draft and its errors live in the client state.
 */
function AddUserEditor({
  core,
  load,
  close,
}: {
  core: BackofficeCore;
  load: (action: () => Promise<void>) => Promise<void>;
  close: () => void;
}) {
  const editor = useBackofficeState(core, (state) => state.userEditor);

  // Opening always starts from a clean draft, even after an aborted attempt.
  useEffect(() => {
    core.admin.resetUserEditor();
  }, [core]);

  const create = () =>
    void load(async () => {
      await core.admin.createUser();
      if (!core.getState().userEditor.error) close();
    });

  return (
    <div className="row-editor">
      <h2>Add user</h2>
      {editor.error ? <p className="error">{editor.error.message}</p> : null}
      <div className="fields">
        <label>
          <span>name *</span>
          <input
            value={editor.draft.name}
            onChange={(event) => {
              core.admin.setUserDraft({ name: event.target.value });
            }}
          />
        </label>
        <label>
          <span>email *</span>
          <input
            type="email"
            value={editor.draft.email}
            onChange={(event) => {
              core.admin.setUserDraft({ email: event.target.value });
            }}
          />
        </label>
        <label>
          <span>password * (min 8 characters)</span>
          <input
            type="password"
            value={editor.draft.password}
            onChange={(event) => {
              core.admin.setUserDraft({ password: event.target.value });
            }}
          />
        </label>
      </div>
      <div className="editor-actions">
        <button className="primary" onClick={create}>
          Create
        </button>
        <button onClick={close}>Cancel</button>
      </div>
    </div>
  );
}

/** The users table page: the generic console plus user-specific affordances. */
export function UsersPage({
  core,
  load,
  onOpen,
  routeFilters,
  routeLimit,
  routeOffset,
}: {
  core: BackofficeCore;
  load: (action: () => Promise<void>) => Promise<void>;
  onOpen: (userId: string) => void;
  routeFilters?: RowFilter[] | undefined;
  routeLimit?: number | undefined;
  routeOffset?: number | undefined;
}) {
  return (
    <TablePage
      core={core}
      load={load}
      table="user"
      heading="Users"
      routeFilters={routeFilters}
      routeLimit={routeLimit}
      routeOffset={routeOffset}
      insertControl={{
        label: "Add user",
        editor: (close) => (
          <AddUserEditor core={core} load={load} close={close} />
        ),
      }}
      rowActions={(row: TableRow) => (
        <button
          onClick={() => {
            onOpen(rowText(row.id));
          }}
        >
          Open
        </button>
      )}
      deleteConfirm={(row) =>
        `Delete user ${rowText(row.email)}? This cannot be undone.`
      }
    />
  );
}
