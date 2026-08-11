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
        {auth.status === "authenticated" ? (
          <UserMenu core={core} name={auth.user.name} email={auth.user.email} />
        ) : null}
      </header>
      <main>{children}</main>
    </div>
  );
}

/**
 * Who is signed in, and the one thing you can do about it. A menu rather than a
 * permanent button: signing out is not an action that should sit one stray click
 * from everything else in the header.
 *
 * `details` because a disclosure is exactly what this is — the browser opens and
 * closes it from the keyboard already, so there is no state to keep and no focus
 * trap to write.
 */
function UserMenu({
  core,
  name,
  email,
}: {
  core: AppCore;
  name: string;
  email: string;
}) {
  return (
    <details className="user-menu">
      <summary>
        <span className="avatar" aria-hidden="true">
          {initials(name, email)}
        </span>
        <span className="muted">{name || email}</span>
      </summary>
      <div className="user-menu-panel">
        <span className="identity">
          <strong>{name || "Signed in"}</strong>
          <span className="muted">{email}</span>
        </span>
        <button
          type="button"
          className="ghost"
          onClick={() => {
            void core.session.signOut();
          }}
        >
          Sign out
        </button>
      </div>
    </details>
  );
}

/** Up to two letters, from whichever of the two the account actually has. */
function initials(name: string, email: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return email.slice(0, 1);
  return words
    .slice(0, 2)
    .map((word) => word.slice(0, 1))
    .join("");
}
