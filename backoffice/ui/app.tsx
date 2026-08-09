import { useCallback, useEffect } from "react";

import { ApiError } from "../client/index.js";
import type { BackofficeCore, Route } from "../client/index.js";

import { OrganizationDetailPage } from "./organization-detail-page.js";
import { OrganizationsPage } from "./organizations-page.js";
import { Setup } from "./setup.js";
import { SignIn } from "./sign-in.js";
import { TablePage } from "./table-page.js";
import { useBackofficeState } from "./use-backoffice-state.js";
import { UserDetailPage } from "./user-detail-page.js";
import { UsersPage } from "./users-page.js";

export function App({ core }: { core: BackofficeCore }) {
  const auth = useBackofficeState(core, (state) => state.auth);
  const route = useBackofficeState(core, (state) => state.route);
  const tables = useBackofficeState(core, (state) => state.tables);

  // Every page load funnels through this so an expired session lands back on
  // the sign-in screen instead of scattered errors.
  const load = useCallback(
    async (action: () => Promise<void>) => {
      try {
        await action();
      } catch (error) {
        if (
          error instanceof ApiError &&
          error.code === "AUTHENTICATION_REQUIRED"
        )
          await core.auth.loadStatus();
        else throw error;
      }
    },
    [core],
  );

  const authenticated = auth.status === "authenticated";
  useEffect(() => {
    if (authenticated) void load(() => core.data.loadTables());
  }, [authenticated, core, load]);

  if (auth.status === "unknown") return null;
  if (auth.status === "needs-setup") return <Setup core={core} />;
  if (auth.status !== "authenticated") return <SignIn core={core} />;

  const navigate = (target: Route) => {
    core.navigation.navigate(target);
  };
  const navButton = (target: Route, label: string, active: boolean) => (
    <button
      key={label}
      className={`nav-link${active ? " active" : ""}`}
      onClick={() => {
        navigate(target);
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="brand">Backoffice</div>
        <nav>
          <span className="nav-section">Console</span>
          {navButton(
            { kind: "table", table: "user" },
            "Users",
            (route.kind === "table" && route.table === "user") ||
              route.kind === "user",
          )}
          {navButton(
            { kind: "table", table: "organizations" },
            "Organizations",
            (route.kind === "table" && route.table === "organizations") ||
              route.kind === "organization",
          )}
          <span className="nav-section">Tables</span>
          {tables
            .filter(
              (table) =>
                table.name !== "user" && table.name !== "organizations",
            )
            .map((table) =>
              navButton(
                { kind: "table", table: table.name },
                table.name,
                route.kind === "table" && route.table === table.name,
              ),
            )}
        </nav>
        <footer>
          <span className="sidebar-email" title={auth.email}>
            {auth.email}
          </span>
          <button onClick={() => void core.auth.signOut()}>Sign out</button>
        </footer>
      </aside>
      <main>
        {route.kind === "user" ? (
          <UserDetailPage
            core={core}
            load={load}
            userId={route.userId}
            onBack={() => {
              navigate({ kind: "table", table: "user" });
            }}
            onOpenOrganization={(organizationId) => {
              navigate({ kind: "organization", organizationId });
            }}
          />
        ) : route.kind === "organization" ? (
          <OrganizationDetailPage
            core={core}
            load={load}
            organizationId={route.organizationId}
            onBack={() => {
              navigate({ kind: "table", table: "organizations" });
            }}
          />
        ) : route.table === "user" ? (
          <UsersPage
            core={core}
            load={load}
            onOpen={(userId) => {
              navigate({ kind: "user", userId });
            }}
            routeFilters={route.filters}
            routeLimit={route.limit}
            routeOffset={route.offset}
          />
        ) : route.table === "organizations" ? (
          <OrganizationsPage
            core={core}
            load={load}
            onOpen={(organizationId) => {
              navigate({ kind: "organization", organizationId });
            }}
            routeFilters={route.filters}
            routeLimit={route.limit}
            routeOffset={route.offset}
          />
        ) : (
          <TablePage
            core={core}
            load={load}
            table={route.table}
            routeFilters={route.filters}
            routeLimit={route.limit}
            routeOffset={route.offset}
          />
        )}
      </main>
    </div>
  );
}
