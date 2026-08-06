import { useState } from "react";

import type { BackofficeCore } from "../core/index.js";

import { useBackofficeState } from "./use-backoffice-state.js";

export function Setup({ core }: { core: BackofficeCore }) {
  const auth = useBackofficeState(core, (state) => state.auth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [mismatch, setMismatch] = useState(false);
  const error = auth.status === "needs-setup" ? auth.error : undefined;

  return (
    <div className="sign-in">
      <form
        className="panel"
        onSubmit={(event) => {
          event.preventDefault();
          if (password !== confirmation) {
            setMismatch(true);
            return;
          }
          setMismatch(false);
          void core.auth.setup({ email, password });
        }}
      >
        <h1>Backoffice setup</h1>
        <p>
          No backoffice admin is configured yet. Create the credential that this
          backoffice — separate from application accounts — will sign in with.
        </p>
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
            minLength={8}
            required
          />
        </label>
        <label>
          Confirm password
          <input
            type="password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            required
          />
        </label>
        {mismatch ? <p className="error">The passwords do not match</p> : null}
        {error ? <p className="error">{error.message}</p> : null}
        <button type="submit">Create admin</button>
      </form>
    </div>
  );
}
