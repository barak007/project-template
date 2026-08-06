import { useCallback, useState } from "react";

import { ApiError } from "../core/index.js";
import type { BackofficeCore } from "../core/index.js";

import { OrganizationDetailPage } from "./organization-detail-page.js";
import { OrganizationsPage } from "./organizations-page.js";
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
  const [forbidden, setForbidden] = useState(false);

  // Every page load funnels through this so a non-admin session lands on one
  // clear panel instead of scattered errors.
  const load = useCallback(async (action: () => Promise<void>) => {
    try {
      await action();
      setForbidden(false);
    } catch (error) {
      if (error instanceof ApiError && error.code === "FORBIDDEN")
        setForbidden(true);
      else throw error;
    }
  }, []);

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
        <span>{auth.user.email}</span>
        <button onClick={() => void core.auth.signOut()}>Sign out</button>
      </header>
      <main>
        {forbidden ? (
          <section className="panel">
            <h1>You are not a platform admin</h1>
            <p>
              Ask an operator to run{" "}
              <code>pnpm admin:grant {auth.user.email}</code> and sign in again.
            </p>
          </section>
        ) : view.kind === "users" ? (
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
