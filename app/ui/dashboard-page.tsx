import { useEffect } from "react";

import { actionKeys, hasLoaded, isPending, loadKeys } from "../client/index.js";
import type { AppCore } from "../client/index.js";

import { CreateForm } from "./create-form.js";
import { EntityIcon } from "./entity-icon.js";
import { ErrorBanner } from "./error-banner.js";
import { InboxSection } from "./inbox-section.js";
import { PageHeader } from "./page-header.js";
import { RouteLink } from "./route-link.js";
import { Skeleton } from "./skeleton.js";
import { useAppState } from "./use-app-state.js";

/** The first page behind the login: the user's organizations. */
export function DashboardPage({ core }: { core: AppCore }) {
  const organizations = useAppState(core, (state) => state.organizations);
  const draft = useAppState(core, (state) => state.organizationDraft);
  const loaded = useAppState(core, (state) =>
    hasLoaded(state, loadKeys.organizations),
  );
  const creating = useAppState(
    core,
    (state) => state.openForm === "organization",
  );
  const pending = useAppState(core, (state) =>
    isPending(state, actionKeys.createOrganization),
  );

  useEffect(() => {
    void core.organizations.load();
    // An invitation arrives from an organization the user cannot see yet, so
    // the dashboard is where it has to surface — nowhere else would.
    void core.inbox.load();
  }, [core]);

  const form = (
    <CreateForm
      label="Organization name"
      placeholder="Analytical Engines"
      value={draft.name}
      pending={pending}
      submitLabel="Create organization"
      onChange={(name) => {
        core.organizations.changeDraft({ name });
      }}
      onSubmit={() => {
        void core.organizations.create();
      }}
      onCancel={() => {
        core.organizations.cancelCreating();
      }}
    />
  );

  return (
    <section className="page">
      <PageHeader
        core={core}
        entity="organization"
        title="Your organizations"
        lead="Everything in the app belongs to an organization — data, members and access all follow it."
        action={
          // The empty state carries this action instead, so it is not offered
          // twice on a page with nothing on it.
          organizations.length > 0 && !creating ? (
            <button
              type="button"
              onClick={() => {
                core.organizations.startCreating();
              }}
            >
              New organization
            </button>
          ) : undefined
        }
      />
      <ErrorBanner core={core} />

      <InboxSection core={core} />

      {creating && organizations.length > 0 ? form : null}

      {!loaded ? (
        <Skeleton />
      ) : organizations.length === 0 ? (
        <div className="empty">
          <p>
            No organizations yet. An organization is what everything else
            belongs to, so this is the first thing to make.
          </p>
          {form}
        </div>
      ) : (
        <ul className="rows">
          {organizations.map((organization) => (
            <li key={organization.id}>
              <RouteLink
                core={core}
                to={{ kind: "organization", organizationId: organization.id }}
                className="row-main"
              >
                <strong className="entity-chip">
                  <EntityIcon entity="organization" />
                  {organization.name}
                </strong>
                <span className="row-meta">
                  since {new Date(organization.createdAt).toLocaleDateString()}
                </span>
              </RouteLink>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
