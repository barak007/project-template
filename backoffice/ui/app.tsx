import { useCallback, useState } from "react";

import { ApiError } from "../core/index.js";
import type { BackofficeCore } from "../core/index.js";

import { OrganizationDetailPage } from "./organization-detail-page.js";
import { OrganizationsPage } from "./organizations-page.js";
import { Setup } from "./setup.js";
import { SignIn } from "./sign-in.js";
import { useBackofficeState } from "./use-backoffice-state.js";
import { UsersPage } from "./users-page.js";

export type View =
  | { kind: "users" }
  | { kind: "organizations" }
  | { kind: "organization"; organizationId: string };

export function App({ core }: { core: BackofficeCore }) {
  const auth = useBackofficeState(core, (state) => state.auth);
  const [view, setView] = useState<View>({ kind: "users" });

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

  if (auth.status === "unknown") return null;
  if (auth.status === "needs-setup") return <Setup core={core} />;
  if (auth.status !== "authenticated") return <SignIn core={core} />;

  return (
    <div className="layout">
      <header>
        <strong>Backoffice</strong>
        <nav>
          <button
            className={view.kind === "users" ? "active" : ""}
            onClick={() => setView({ kind: "users" })}
          >
            Users
          </button>
          <button
            className={view.kind !== "users" ? "active" : ""}
            onClick={() => setView({ kind: "organizations" })}
          >
            Organizations
          </button>
        </nav>
        <span className="spacer" />
        <span>{auth.email}</span>
        <button onClick={() => void core.auth.signOut()}>Sign out</button>
      </header>
      <main>
        {view.kind === "users" ? (
          <UsersPage core={core} load={load} />
        ) : view.kind === "organizations" ? (
          <OrganizationsPage
            core={core}
            load={load}
            onOpen={(organizationId) =>
              setView({ kind: "organization", organizationId })
            }
          />
        ) : (
          <OrganizationDetailPage
            core={core}
            load={load}
            organizationId={view.organizationId}
            onBack={() => setView({ kind: "organizations" })}
          />
        )}
      </main>
    </div>
  );
}
