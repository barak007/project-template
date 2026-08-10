import { useEffect } from "react";

import { currentOrganization, currentWorkspace } from "../client/index.js";
import type { AppCore } from "../client/index.js";

import { ErrorBanner } from "./error-banner.js";
import { RouteLink } from "./route-link.js";
import { useAppState } from "./use-app-state.js";

/**
 * One workspace and the repositories it works on. Picking repositories is the
 * whole page: the name is set where the workspace is created, and a session
 * opens exactly this list.
 */
export function WorkspacePage({
  core,
  organizationId,
  workspaceId,
}: {
  core: AppCore;
  organizationId: string;
  workspaceId: string;
}) {
  const organization = useAppState(core, currentOrganization);
  const workspace = useAppState(core, currentWorkspace);
  const sources = useAppState(core, (state) => state.sources);
  const repositories = useAppState(core, (state) => state.repositories);
  const connections = useAppState(core, (state) => state.connections);

  useEffect(() => {
    void core.organizations.load();
    void core.workspaces.load(organizationId);
    void core.repositories.load(organizationId);
  }, [core, organizationId]);

  // Derived during render, never in a selector: a filter builds a fresh array
  // every call, which useSyncExternalStore reads as a changed snapshot.
  const attached = sources.filter((source) =>
    workspace?.sourceIds.includes(source.id),
  );
  const attachedNames = new Set(attached.map((source) => source.name));
  // A repository already in this workspace is not offered again. Matching on
  // name is what the import does when it reuses an existing source.
  const available = repositories.filter(
    (repository) => !attachedNames.has(repository.name),
  );
  const nothingAvailable =
    connections.length === 0
      ? "No repository source connected yet — connect one on the organization page."
      : "Every repository this source exposes is already in the workspace.";

  return (
    <section className="page">
      <header className="page-header">
        <RouteLink
          core={core}
          to={{ kind: "organization", organizationId }}
          className="link"
        >
          ← {organization?.name ?? "Organization"}
        </RouteLink>
        <h1>{workspace?.name ?? "Workspace"}</h1>
        <p className="muted">
          A session opens these repositories together in one folder.
        </p>
      </header>
      <ErrorBanner core={core} />

      <h2>Repositories</h2>
      {attached.length === 0 ? (
        <p className="empty">No repositories in this workspace yet.</p>
      ) : (
        <ul className="rows">
          {attached.map((source) => (
            <li key={source.id}>
              <strong>{source.name}</strong>
              <button
                className="ghost danger"
                onClick={() => {
                  void core.repositories.remove(
                    organizationId,
                    workspaceId,
                    source.id,
                  );
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <h2>Available</h2>
      {available.length === 0 ? (
        <p className="empty">{nothingAvailable}</p>
      ) : (
        <ul className="rows">
          {available.map((repository) => (
            <li key={`${repository.connectionId}:${repository.externalId}`}>
              <strong>{repository.name}</strong>
              <span className="muted">{repository.remote}</span>
              <button
                onClick={() => {
                  void core.repositories.add(organizationId, workspaceId, {
                    connectionId: repository.connectionId,
                    externalId: repository.externalId,
                  });
                }}
              >
                Add
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
