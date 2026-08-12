import { useEffect } from "react";

import {
  actionKeys,
  confirmKeys,
  currentOrganization,
  hasLoaded,
  isPending,
  loadKeys,
  managesOrganization,
} from "../client/index.js";
import type { AppCore } from "../client/index.js";

import { ConfirmButton } from "./confirm-button.js";
import { CreateForm } from "./create-form.js";
import { EntityIcon } from "./entity-icon.js";
import { ErrorBanner } from "./error-banner.js";
import { InvitationsSection } from "./invitations-section.js";
import { MembersSection } from "./members-section.js";
import { PageHeader } from "./page-header.js";
import { RouteLink } from "./route-link.js";
import { Section } from "./section.js";
import { Skeleton } from "./skeleton.js";
import { useAppState } from "./use-app-state.js";

/** One organization: its workspaces, and who can reach them. */
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
  const loaded = useAppState(core, (state) =>
    hasLoaded(state, loadKeys.workspaces(organizationId)),
  );
  const creating = useAppState(core, (state) => state.openForm === "workspace");
  const pending = useAppState(core, (state) =>
    isPending(state, actionKeys.createWorkspace),
  );
  const manages = useAppState(core, managesOrganization);

  useEffect(() => {
    void core.organizations.load();
    void core.workspaces.load(organizationId);
    void core.members.load(organizationId);
  }, [core, organizationId]);

  // Only an owner may read the invitations, so asking before the members list
  // says who this user is would be a request the server refuses.
  useEffect(() => {
    if (!manages) return;
    void core.invitations.load(organizationId);
  }, [core, organizationId, manages]);

  const form = (
    <CreateForm
      label="Workspace name"
      placeholder="Reporting"
      value={draft.name}
      pending={pending}
      submitLabel="Create workspace"
      onChange={(name) => {
        core.workspaces.changeDraft({ name });
      }}
      onSubmit={() => {
        void core.workspaces.create(organizationId);
      }}
      onCancel={() => {
        core.workspaces.cancelCreating();
      }}
    />
  );

  return (
    <section className="page">
      <PageHeader
        core={core}
        entity="organization"
        title={organization?.name ?? "Organization"}
        lead="A workspace groups the repositories a session opens together."
        action={
          workspaces.length > 0 && !creating ? (
            <button
              type="button"
              onClick={() => {
                core.workspaces.startCreating();
              }}
            >
              New workspace
            </button>
          ) : undefined
        }
      />
      <ErrorBanner core={core} />

      <Section title="Workspaces">
        {creating && workspaces.length > 0 ? form : null}
        {!loaded ? (
          <Skeleton />
        ) : workspaces.length === 0 ? (
          <div className="empty">
            <p>
              No workspaces yet. A workspace is the set of repositories a
              session opens together.
            </p>
            {form}
          </div>
        ) : (
          <ul className="rows">
            {workspaces.map((workspace) => (
              <li key={workspace.id}>
                <RouteLink
                  core={core}
                  to={{
                    kind: "workspace",
                    organizationId,
                    workspaceId: workspace.id,
                  }}
                  className="row-main"
                >
                  <strong className="entity-chip">
                    <EntityIcon entity="workspace" />
                    {workspace.name}
                  </strong>
                  <span className="row-meta">
                    {workspace.sourceIds.length} repositor
                    {workspace.sourceIds.length === 1 ? "y" : "ies"}
                  </span>
                </RouteLink>
                <div className="row-actions">
                  <ConfirmButton
                    core={core}
                    confirmKey={confirmKeys.deleteWorkspace(workspace.id)}
                    actionKey={actionKeys.deleteWorkspace(workspace.id)}
                    label="Delete"
                    question={`Delete ${workspace.name} and its sessions?`}
                    onConfirm={() => {
                      void core.workspaces.delete(organizationId, workspace.id);
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <MembersSection core={core} organizationId={organizationId} />

      {/* Inviting is an owner's action, and a section offering what the server
          would refuse is worse than no section. */}
      {manages ? (
        <InvitationsSection core={core} organizationId={organizationId} />
      ) : null}
    </section>
  );
}
