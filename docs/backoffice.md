# Backoffice

The backoffice is the platform operator console shipped with the boilerplate: a
read-only React SPA in [backoffice/](../backoffice/) where the developers of an
app built from this boilerplate can inspect every tenant — all users, all
organizations, and each organization's members, sources, workspaces, and work
sessions.

It is cross-tenant by design and therefore gated by a separate authorization
axis from organization roles: the `platform_admins` table. A platform admin is
a regular Better Auth user with a grant row; nothing about their organization
memberships changes.

## What it deliberately does not show

Admin responses carry inventory and status only — never source `config`,
work-session snapshots, or secret material. Secret values are unrecoverable
through the API in general; the backoffice does not even list secret keys.

## Granting the first admin

1. The operator signs up through the app's normal email + password flow.
2. Someone with `DATABASE_URL` access runs:

   ```sh
   pnpm admin:grant operator@example.com
   ```

Grants are idempotent. There is no in-band endpoint for granting — it is a
deliberate out-of-band step, like a database migration.

## Development workflow

```sh
pnpm dev             # API server on :3000
pnpm backoffice:dev  # Vite dev server on :5173, proxying /api to :3000
```

The dev server proxies `/api`, so session cookies stay same-origin.
`TRUSTED_ORIGINS` in `.env` must include `http://localhost:5173` (the default
in `.env.example` does).

Signing in with an account that has no grant shows a "You are not a platform
admin" panel — the API answers `403 FORBIDDEN` for every `/api/admin` route.

## Architecture

The backoffice follows the same headless discipline as the application client
(see [AGENTS.md](../AGENTS.md)): all logic lives in
[backoffice/core/](../backoffice/core/) as actions + events + a pure projection
over a store, tested in Node against the real server
([backoffice/tests/](../backoffice/tests/)); the React UI in
[backoffice/ui/](../backoffice/ui/) is a rendering adapter that owns no logic.

There is no second client stack: `createBackofficeCore` **composes the
application client core** — auth and every other client-side operation are the
client's (`core.auth`, `core.client`), never reimplemented — and adds only the
platform-admin actions and state slices on top, exposed as one combined
`getState`/`subscribe`. Signing out through the client core resets the admin
slices with it. ESLint zones enforce the boundary: the backoffice may import
the client core's public entry (and its generic store/errors/host modules),
nothing else.

Server-side, the `/api/admin` routes live in
[src/routes/admin.ts](../src/routes/admin.ts) →
[src/services/admin.ts](../src/services/admin.ts), each service function
calling `requirePlatformAdmin` first.

## Deploying (follow-up)

The build (`pnpm build`) emits a static SPA to `backoffice/dist`, which v1 does
not serve from the API process. Deploy it wherever suits your app — the
simplest follow-up is serving `backoffice/dist` under the app's own domain so
cookies keep working without CORS.
