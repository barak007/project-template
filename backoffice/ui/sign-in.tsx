import { useState } from "react";

import type { BackofficeCore } from "../core/index.js";

import { useBackofficeState } from "./use-backoffice-state.js";

export function SignIn({ core }: { core: BackofficeCore }) {
  const auth = useBackofficeState(core, (state) => state.auth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const error = auth.status === "anonymous" ? auth.error : undefined;

  return (
    <div className="sign-in">
      <form
        className="panel"
        onSubmit={(event) => {
          event.preventDefault();
          void core.auth.signIn({ email, password });
        }}
      >
        <h1>Backoffice</h1>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {error ? <p className="error">{error.message}</p> : null}
        <button type="submit">Sign in</button>
      </form>
    </div>
  );
}
