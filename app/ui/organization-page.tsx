import { useEffect } from "react";

import { currentOrganization } from "../client/index.js";
import type { AppCore } from "../client/index.js";

import { ErrorBanner } from "./error-banner.js";
import { RouteLink } from "./route-link.js";
import { useAppState } from "./use-app-state.js";

/** One organization and its workspaces — the app's example of scoped work. */
export function OrganizationPage({
  core,
  organizationId,
}: {
  core: AppCore;
  organizationId: string;
}) {
  const organization = useAppState(core, currentOrganization);
  const workspaces = useAppState(core, (state) => state.workspaces);
  const draft = useAppState(core, (state) => state.workspaceDraft);

  useEffect(() => {
    void core.organizations.load();
    void core.workspaces.load(organizationId);
  }, [core, organizationId]);

  return (
    <section className="page">
      <header className="page-header">
        <RouteLink core={core} to={{ kind: "dashboard" }} className="link">
          ← All organizations
        </RouteLink>
        <h1>{organization?.name ?? "Organization"}</h1>
        <p className="muted">Workspaces group the sources a session reads.</p>
      </header>
      <ErrorBanner core={core} />
      {workspaces.length === 0 ? (
        <p className="empty">No workspaces yet.</p>
      ) : (
        <ul className="rows">
          {workspaces.map((workspace) => (
            <li key={workspace.id}>
              <strong>{workspace.name}</strong>
              <span className="muted">
                {workspace.sourceIds.length} source
                {workspace.sourceIds.length === 1 ? "" : "s"}
              </span>
              <button
                className="ghost danger"
                onClick={() => {
                  void core.workspaces.delete(organizationId, workspace.id);
                }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="inline-form"
        onSubmit={(event) => {
          event.preventDefault();
          void core.workspaces.create(organizationId);
        }}
      >
        <label>
          New workspace
          <input
            value={draft.name}
            placeholder="Reporting"
            onChange={(event) => {
              core.workspaces.changeDraft({ name: event.target.value });
            }}
          />
        </label>
        <button type="submit" disabled={draft.name.trim() === ""}>
          Create
        </button>
      </form>
    </section>
  );
}
