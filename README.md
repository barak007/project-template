# What We Sure About

A production-ready Node.js domain service built with TypeScript, Hono, PostgreSQL, Drizzle, Better Auth, and pg-boss. The domain model it implements is described in [`docs/domain.md`](./docs/domain.md); conventions for changing the code are in [`AGENTS.md`](./AGENTS.md).

## Local development

Requirements: Node 24, pnpm 11, Docker, and Docker Compose.

```sh
cp .env.example .env
docker compose up -d postgres
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Use `openssl rand -base64 32` for `SECRETS_ENCRYPTION_KEY` and a separate random value of at least 32 characters for `BETTER_AUTH_SECRET`. The sample encryption key is intentionally public and must never be used outside local development.

The API listens on `http://localhost:3000`. Liveness is `GET /health`, dependency readiness is `GET /ready`, and Better Auth is mounted at `/api/auth/*`. Sign up through `POST /api/auth/sign-up/email`, then use the returned secure session cookie with domain routes.

## API surface

All domain routes require authentication. Organization routes additionally enforce service-layer membership permissions.

- `/api/organizations` and `/api/organizations/:organizationId/members`
- `/api/organizations/:organizationId/sources`
- `/api/organizations/:organizationId/workspaces`
- `/api/organizations/:organizationId/work-sessions`
- `/api/organizations/:organizationId/secrets` and `/data`
- `/api/me/secrets` and `/api/me/data`

Owners manage memberships and all resources. Admins manage resources and secrets. Members have read access. Organization creation atomically assigns its creator as owner. Secret values are encrypted at rest and never returned by the API. Work sessions snapshot workspace sources and merged organization/user values; user values win on duplicate keys.

## Backoffice

A read-only operator console for inspecting all tenants ships in [`backoffice/`](./backoffice/): sign up normally, grant yourself platform admin with `pnpm admin:grant <email>`, then run `pnpm backoffice:dev` alongside `pnpm dev`. See [`docs/backoffice.md`](./docs/backoffice.md).

## Commands

`pnpm check` mirrors CI: formatting, linting, strict type checking, tests with coverage, then production build. Tests run the full stack against an in-process Postgres (PGlite) with the real migrations applied, so no services are needed. The real-Postgres integration test additionally runs when `DATABASE_URL` is present; for that, use a database name containing `test` and run `pnpm db:test:setup` before `pnpm test`.

`pnpm test:coverage` writes a report to `coverage/` (open `coverage/index.html`) and fails if coverage drops below the thresholds in [`vitest.config.ts`](./vitest.config.ts). Those thresholds are ratchet floors: raise them as tests land, never lower them.

Database definitions live in [`src/db/schema.ts`](./src/db/schema.ts). Change those definitions, run `pnpm db:generate`, review the SQL, and commit the migration. Production only runs committed migrations; it never performs a schema push.

The API and worker are separate processes from the same Docker image:

```sh
docker build -t what-we-sure-about .
docker run --env-file .env what-we-sure-about
docker run --env-file .env what-we-sure-about node dist/worker.js
```

See [`docs/deployment.md`](./docs/deployment.md) for production, preview, monitoring, branch protection, and rollback operations.
