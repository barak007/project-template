import type { AppCore } from "../client/index.js";

import { RouteLink } from "./route-link.js";
import { SiteHeader } from "./site-header.js";
import { useAppState } from "./use-app-state.js";

export function SignUpPage({ core }: { core: AppCore }) {
  const draft = useAppState(core, (state) => state.signUpDraft);
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
            void core.session.signUp();
          }}
        >
          <h1>Create your account</h1>
          <label>
            Name
            <input
              autoComplete="name"
              value={draft.name}
              onChange={(event) => {
                core.session.changeSignUpDraft({ name: event.target.value });
              }}
              required
            />
          </label>
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              value={draft.email}
              onChange={(event) => {
                core.session.changeSignUpDraft({ email: event.target.value });
              }}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={draft.password}
              onChange={(event) => {
                core.session.changeSignUpDraft({
                  password: event.target.value,
                });
              }}
              required
            />
          </label>
          {rejection ? <p className="error">{rejection.message}</p> : null}
          <button type="submit">Create account</button>
          <p className="muted">
            Already registered?{" "}
            <RouteLink core={core} to={{ kind: "sign-in" }} className="link">
              Sign in
            </RouteLink>
          </p>
        </form>
      </main>
    </div>
  );
}
