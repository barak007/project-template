import { useEffect } from "react";

import type { AppCore } from "../client/index.js";

import { EntityIcon } from "./entity-icon.js";
import { ErrorBanner } from "./error-banner.js";
import { RouteLink } from "./route-link.js";
import { useAppState } from "./use-app-state.js";

/** The first page behind the login: the user's organizations. */
export function DashboardPage({ core }: { core: AppCore }) {
  const organizations = useAppState(core, (state) => state.organizations);
  const draft = useAppState(core, (state) => state.organizationDraft);

  useEffect(() => {
    void core.organizations.load();
  }, [core]);

  return (
    <section className="page">
      <header className="page-header">
        <h1 className="entity-chip">
          <EntityIcon entity="organization" />
          Your organizations
        </h1>
        <p className="muted">
          Everything in the app belongs to an organization — data, members and
          access all follow it.
        </p>
      </header>
      <ErrorBanner core={core} />
      {organizations.length === 0 ? (
        <p className="empty">
          No organizations yet. Create the first one below.
        </p>
      ) : (
        <ul className="cards">
          {organizations.map((organization) => (
            <li key={organization.id}>
              <RouteLink
                core={core}
                to={{ kind: "organization", organizationId: organization.id }}
                className="card"
              >
                <strong className="entity-chip">
                  <EntityIcon entity="organization" />
                  {organization.name}
                </strong>
                <span className="muted">
                  since {new Date(organization.createdAt).toLocaleDateString()}
                </span>
              </RouteLink>
            </li>
          ))}
        </ul>
      )}
      <form
        className="inline-form"
        onSubmit={(event) => {
          event.preventDefault();
          void core.organizations.create();
        }}
      >
        <label>
          New organization
          <input
            value={draft.name}
            placeholder="Analytical Engines"
            onChange={(event) => {
              core.organizations.changeDraft({ name: event.target.value });
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
