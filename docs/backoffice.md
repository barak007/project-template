# Backoffice

The backoffice is the platform operator console shipped with the boilerplate: a
read-only React SPA in [backoffice/](../backoffice/) where the developers of an
app built from this boilerplate can inspect every tenant — all users, all
organizations, and each organization's members, sources, workspaces, and work
sessions.

It is cross-tenant by design and therefore authenticated by a **standalone
backoffice admin credential** — deliberately not an application user. The
credential (an email plus a scrypt password hash, never the raw password)
lives in the server environment as `BACKOFFICE_ADMIN_EMAIL` /
`BACKOFFICE_ADMIN_PASSWORD_HASH`, and signing in issues a signed, HTTP-only
session cookie that is independent of Better Auth sessions.

## What it deliberately does not show

Admin responses carry inventory and status only — never source `config`,
work-session snapshots, or secret material. Secret values are unrecoverable
through the API in general; the backoffice does not even list secret keys.

## First-run setup

While the credential is unconfigured (both env vars empty or absent), opening
the backoffice shows a **setup screen** instead of the sign-in box. Creating
the admin there:

1. hashes the chosen password (scrypt, `backoffice/server/password.ts`),
2. writes both values back to the server's `.env` file
   (`backoffice/server/env-file.ts`), and
3. signs the browser in immediately — no restart needed.

Once configured, `POST /backoffice/auth/setup` answers `409 CONFLICT`;
changing the credential means editing `.env` (clear both values to re-run
setup).

## Development workflow

```sh
pnpm dev             # API on :3000 (hot-reloaded) + backoffice on :5173
```

One command runs both: the API is served through Vite's SSR module runner,
so edits under `src/` swap the app in-process without a restart, and the
backoffice Vite dev server on :5173 proxies `/api` to :3000
(`pnpm backoffice:dev` still runs the UI alone against an already-running API).

The dev server proxies `/api`, so session cookies stay same-origin.
`TRUSTED_ORIGINS` in `.env` must include `http://localhost:5173` (the default
in `.env.example` does).

Application accounts cannot sign in here: the sign-in box checks only the
backoffice credential, and every `/backoffice/admin` route answers
`401 AUTHENTICATION_REQUIRED` without the backoffice session cookie.

## Architecture

The backoffice follows the same headless discipline as the application client
(see [AGENTS.md](../AGENTS.md)): all logic lives in
[backoffice/core/](../backoffice/core/) as actions + events + a pure projection
over a store, tested in Node against the real server
([backoffice/tests/](../backoffice/tests/)); the React UI in
[backoffice/ui/](../backoffice/ui/) is a rendering adapter that owns no logic.

Because the backoffice admin is not an application user, the core does **not**
compose the application client core — it owns its auth slice
(`unknown → needs-setup | anonymous → authenticated`) driven by
`auth.loadStatus()` at boot, plus the admin actions, exposed as one
`getState`/`subscribe`. It still reuses the client's generic building blocks
(store/errors/host), and ESLint zones keep everything else out.

All backoffice server code lives in
[backoffice/server/](../backoffice/server/) — routes, services, entities, the
session cookie, password hashing, the `.env` writer, and its own environment
schema ([backoffice/server/env.ts](../backoffice/server/env.ts), which owns
`BACKOFFICE_PORT` and the admin credential; `src/config/env.ts` knows nothing
about the backoffice). The import direction is strictly backoffice → src: the
only place the app touches the backoffice is the composition entries
(`src/server.ts`, `src/dev-app.ts`), which mount `createBackofficeRoutes()`
under `/backoffice`. Its tests live in
[backoffice/tests/](../backoffice/tests/) with their own harness.

## Deploying (follow-up)

The build (`pnpm build`) emits a static SPA to `backoffice/dist`, which v1 does
not serve from the API process. Deploy it wherever suits your app — the
simplest follow-up is serving `backoffice/dist` under the app's own domain so
cookies keep working without CORS. Note the setup screen writes to `.env` in
the server's working directory; on hosts without a persistent filesystem, set
the two variables in the host's environment configuration instead.
