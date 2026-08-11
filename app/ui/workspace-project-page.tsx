import { useEffect } from "react";

import { currentWorkspace } from "../client/index.js";
import type { AppCore } from "../client/index.js";

import { ErrorBanner } from "./error-banner.js";
import { PageHeader } from "./page-header.js";
import { locationOf } from "./project-location.js";
import { useAppState } from "./use-app-state.js";
import { Workbench } from "./workbench.js";

/**
 * The workspace's own git project: the template holding its repositories as
 * submodules, which every session is a clone of. Read-only here on purpose —
 * work happens in a session, and this is what a session starts from.
 *
 * It is built by the first session, so a workspace nobody has opened yet has
 * nothing to show rather than an error.
 */
export function WorkspaceProjectPage({
  core,
  organizationId,
  workspaceId,
}: {
  core: AppCore;
  organizationId: string;
  workspaceId: string;
}) {
  const workspace = useAppState(core, currentWorkspace);

  useEffect(() => {
    void core.organizations.load();
    void core.workspaces.load(organizationId);
  }, [core, organizationId]);

  const location = workspace?.projectLocation ?? null;

  return (
    <section className="page fills">
      <PageHeader
        core={core}
        entity="project"
        title="Project"
        lead={
          location === null
            ? "The template every session in this workspace clones"
            : `The template every session in this workspace clones · ${locationOf(location)}`
        }
      />
      <ErrorBanner core={core} />

      {/* Nothing is read until the workspace says it has a project: before its
          first session there is none, and while the list loads we do not know. */}
      {location === null ? (
        <div className="empty">
          <p>
            {workspace === undefined
              ? "Loading…"
              : "This project is built by the workspace’s first session."}
          </p>
        </div>
      ) : (
        <Workbench
          core={core}
          organizationId={organizationId}
          target={{ kind: "workspace", id: workspaceId }}
        />
      )}
    </section>
  );
}
