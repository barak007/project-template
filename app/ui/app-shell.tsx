import type { ReactNode } from "react";

import type { AppCore } from "../client/index.js";

import { RouteLink } from "./route-link.js";
import { useAppState } from "./use-app-state.js";

/** The chrome around every page behind the login. */
export function AppShell({
  core,
  children,
}: {
  core: AppCore;
  children: ReactNode;
}) {
  const auth = useAppState(core, (state) => state.auth);

  return (
    <div className="app">
      <header className="app-header">
        <RouteLink core={core} to={{ kind: "dashboard" }} className="brand">
          Acme
        </RouteLink>
        <div className="app-identity">
          {auth.status === "authenticated" ? (
            <span className="muted">{auth.user.email}</span>
          ) : null}
          <button
            className="ghost"
            onClick={() => {
              void core.session.signOut();
            }}
          >
            Sign out
          </button>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
