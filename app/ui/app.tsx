import { useEffect } from "react";

import { visibleRoute } from "../client/index.js";
import type { AppCore } from "../client/index.js";

import { AppShell } from "./app-shell.js";
import { DashboardPage } from "./dashboard-page.js";
import { HomePage } from "./home-page.js";
import { OrganizationPage } from "./organization-page.js";
import { SessionPage } from "./session-page.js";
import { SignInPage } from "./sign-in-page.js";
import { SignUpPage } from "./sign-up-page.js";
import { useAppState } from "./use-app-state.js";
import { WorkspacePage } from "./workspace-page.js";
import { WorkspaceProjectPage } from "./workspace-project-page.js";

/**
 * The whole router of the UI: which page the store says to show. The guard
 * lives in the client (visibleRoute), so this component only maps a route
 * kind to a component.
 */
export function App({ core }: { core: AppCore }) {
  const sessionResolved = useAppState(core, (state) => state.sessionResolved);
  const page = useAppState(core, (state) => visibleRoute(state).kind);
  const route = useAppState(core, (state) => state.route);

  useEffect(() => {
    void core.session.load();
  }, [core]);

  // Until the cookie has been resolved into an identity, any page would be a
  // guess — an authenticated visitor would see the marketing site flash by.
  if (!sessionResolved) return null;

  // The guard pages substitute the route (visibleRoute); everything after them
  // is the route itself, so route.kind narrows each page's parameters.
  if (page === "home") return <HomePage core={core} />;
  if (page === "sign-in") return <SignInPage core={core} />;
  if (page === "sign-up") return <SignUpPage core={core} />;
  if (page === "dashboard")
    return (
      <AppShell core={core}>
        <DashboardPage core={core} />
      </AppShell>
    );

  switch (route.kind) {
    case "organization":
      return (
        <AppShell core={core}>
          <OrganizationPage core={core} organizationId={route.organizationId} />
        </AppShell>
      );
    case "workspace":
      return (
        <AppShell core={core}>
          <WorkspacePage
            core={core}
            organizationId={route.organizationId}
            workspaceId={route.workspaceId}
          />
        </AppShell>
      );
    case "workspace-project":
      return (
        <AppShell core={core}>
          <WorkspaceProjectPage
            core={core}
            organizationId={route.organizationId}
            workspaceId={route.workspaceId}
          />
        </AppShell>
      );
    case "session":
      return (
        <AppShell core={core}>
          <SessionPage
            core={core}
            organizationId={route.organizationId}
            workSessionId={route.workSessionId}
          />
        </AppShell>
      );
    default:
      return null;
  }
}
