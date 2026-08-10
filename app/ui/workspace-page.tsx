import { useEffect } from "react";

import { currentOrganization, currentWorkspace } from "../client/index.js";
import type { AppCore } from "../client/index.js";

import { ErrorBanner } from "./error-banner.js";
import { RouteLink } from "./route-link.js";
import { useAppState } from "./use-app-state.js";

/**
 * One workspace and the repositories it works on. Picking repositories is the
 * whole page: the name is set where the workspace is created, and a session
 * reads exactly this list.
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

  useEffect(() => {
    void core.organizations.load();
    void core.workspaces.load(organizationId);
    void core.repositories.load(organizationId);
  }, [core, organizationId]);

  // Derived during render, never in a selector: a filter builds a fresh array
  // every call, which useSyncExternalStore reads as a changed snapshot.
  const repositories = sources.filter((source) => source.kind === "git");
  const attached = repositories.filter((repository) =>
    workspace?.sourceIds.includes(repository.id),
  );
  const available = repositories.filter(
    (repository) => !workspace?.sourceIds.includes(repository.id),
  );
  const nothingAvailable =
    repositories.length === 0
      ? "No repositories in this organization yet."
      : "Every repository in this organization is already in the workspace.";

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
          {attached.map((repository) => (
            <li key={repository.id}>
              <strong>{repository.name}</strong>
              <button
                className="ghost danger"
                onClick={() => {
                  void core.repositories.detach(
                    organizationId,
                    workspaceId,
                    repository.id,
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
            <li key={repository.id}>
              <strong>{repository.name}</strong>
              <button
                onClick={() => {
                  void core.repositories.attach(
                    organizationId,
                    workspaceId,
                    repository.id,
                  );
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
