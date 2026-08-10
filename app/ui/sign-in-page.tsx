import type { AppCore } from "../client/index.js";

import { RouteLink } from "./route-link.js";
import { SiteHeader } from "./site-header.js";
import { useAppState } from "./use-app-state.js";

export function SignInPage({ core }: { core: AppCore }) {
  const draft = useAppState(core, (state) => state.signInDraft);
  const auth = useAppState(core, (state) => state.auth);
  const rejection = auth.status === "anonymous" ? auth.error : undefined;

  return (
    <div className="site">
      <SiteHeader core={core} />
      <main className="centered">
        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault();
            void core.session.signIn();
          }}
        >
          <h1>Sign in</h1>
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              value={draft.email}
              onChange={(event) => {
                core.session.changeSignInDraft({ email: event.target.value });
              }}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={draft.password}
              onChange={(event) => {
                core.session.changeSignInDraft({
                  password: event.target.value,
                });
              }}
              required
            />
          </label>
          {rejection ? <p className="error">{rejection.message}</p> : null}
          <button type="submit">Sign in</button>
          <p className="muted">
            No account yet?{" "}
            <RouteLink core={core} to={{ kind: "sign-up" }} className="link">
              Create one
            </RouteLink>
          </p>
        </form>
      </main>
    </div>
  );
}
