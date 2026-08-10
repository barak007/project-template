import type { AppCore } from "../client/index.js";

import { useAppState } from "./use-app-state.js";

/**
 * Where this organization's repositories come from. Connecting is its own
 * button rather than part of signing in, because the connection belongs to
 * the organization and outlives whoever set it up.
 */
export function ConnectionPanel({
  core,
  organizationId,
}: {
  core: AppCore;
  organizationId: string;
}) {
  const connections = useAppState(core, (state) => state.connections);
  const draft = useAppState(core, (state) => state.connectionDraft);

  return (
    <section>
      <h2>Repository source</h2>
      {connections.length === 0 ? (
        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            void core.connections.connectLocal(organizationId);
          }}
        >
          <label>
            Folder on this machine
            <input
              value={draft.rootPath}
              placeholder="~/projects"
              onChange={(event) => {
                core.connections.changeDraft({ rootPath: event.target.value });
              }}
            />
          </label>
          <button type="submit" disabled={draft.rootPath.trim() === ""}>
            Connect
          </button>
        </form>
      ) : (
        <ul className="rows">
          {connections.map((connection) => (
            <li key={connection.id}>
              <strong>{connection.label}</strong>
              <span className="muted">{connection.provider}</span>
              <button
                className="ghost danger"
                onClick={() => {
                  void core.connections.disconnect(
                    organizationId,
                    connection.id,
                  );
                }}
              >
                Disconnect
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
