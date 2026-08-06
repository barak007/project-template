import { useCallback, useEffect } from "react";

import { ApiError } from "../client/index.js";
import type { BackofficeCore, Route } from "../client/index.js";

import { OrganizationDetailPage } from "./organization-detail-page.js";
import { OrganizationsPage } from "./organizations-page.js";
import { Setup } from "./setup.js";
import { SignIn } from "./sign-in.js";
import { TablePage } from "./table-page.js";
import { useBackofficeState } from "./use-backoffice-state.js";
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
          {navButton({ kind: "users" }, "Users", route.kind === "users")}
          {navButton(
            { kind: "organizations" },
            "Organizations",
            route.kind === "organizations" || route.kind === "organization",
          )}
          <span className="nav-section">Tables</span>
          {tables.map((table) =>
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
        {route.kind === "users" ? (
          <UsersPage core={core} load={load} />
        ) : route.kind === "organizations" ? (
          <OrganizationsPage
            core={core}
            load={load}
            onOpen={(organizationId) => {
              navigate({ kind: "organization", organizationId });
            }}
          />
        ) : route.kind === "organization" ? (
          <OrganizationDetailPage
            core={core}
            load={load}
            organizationId={route.organizationId}
            onBack={() => {
              navigate({ kind: "organizations" });
            }}
          />
        ) : (
          <TablePage core={core} load={load} table={route.table} />
        )}
      </main>
    </div>
  );
}
