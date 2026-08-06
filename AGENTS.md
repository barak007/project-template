# AGENTS.md

Conventions for changing this codebase. Setup and commands: [README.md](./README.md). Domain model: [docs/domain.md](./docs/domain.md). Deployment and operations: [docs/deployment.md](./docs/deployment.md).

Apps are generated from this boilerplate and inherit whatever you leave here, so fix the general pattern rather than one call site.

## Rules

1. **Relative imports carry the `.js` extension** — `from "../db/schema.js"`, even for a `.ts` file. Native ESM.
2. **Authorization lives in services, not middleware.** Every read or mutation of an organization-owned resource calls `requireOrganizationPermission` from [src/services/policy.ts](src/services/policy.ts) first; middleware only establishes identity.
3. **`organizationId` comes from the validated route parameter**, never from session state, and every organization-scoped query filters on it — including updates and deletes, so an id from another organization gets `404` instead of acting on its row.
4. **Throw `AppError`** ([src/errors.ts](src/errors.ts)), never bare `Error`, and never put SQL, credentials, stack traces, or upstream exception text in a message.
5. **Zod validates both directions**: `zValidator` on input, `responseSchema.parse(...)` before `context.json(...)`. Types are not runtime validation. Better Auth's own endpoints keep Better Auth's response format.
6. **Dependencies are injected, never module singletons.** Services take `db` first; routes read `RuntimeDependencies` off the context. This is what lets [tests/api.test.ts](tests/api.test.ts) run the whole stack with stubs and no database.
7. **Layering is one-directional**: routes → services → db. No Drizzle in routes, no Hono `Context` in services.
8. **Schema changes go through migrations**: edit `src/db/schema.ts`, `pnpm db:generate`, review the SQL, commit it. Never `drizzle-kit push`, never hand-edit a committed migration.
9. **New environment variables go in [src/config/env.ts](src/config/env.ts) and `.env.example`** with a placeholder, never a real secret. Don't read `process.env` elsewhere.
10. **Job handlers are idempotent** — retries and concurrent claims are expected; see the claim-by-status-update in [src/jobs/materialize.ts](src/jobs/materialize.ts). Payloads get a Zod schema; producers and workers stay in separate modules.
11. **Keep `AppType` usable.** `app.ts` exports it for Hono's `hc<AppType>(baseUrl)` client, so routes need types precise enough for consumers.

## Headless client

The application client lives in [client/src](client/src) and is **headless by principle: all client logic is actions and state — rendering is never required to run it.** The decoupling is event-driven: actions call the API and dispatch `ClientEvent` facts ([client/src/events.ts](client/src/events.ts)); the projection ([client/src/projection.ts](client/src/projection.ts)) is the ONE place state changes — a pure `reduce(state, event)` fold. `createClientCore` ([client/src/index.ts](client/src/index.ts)) composes one action namespace per aggregate (`auth`, `organizations`, `sources`, ...; one module per aggregate, mirroring the service-per-aggregate layout) around the store (`getState`/`subscribe`); any UI (React, CLI, TUI) is a thin adapter that subscribes to state and calls actions, and owns no logic. Rules:

1. **No environment coupling — everything environmental enters through the `Host`** ([client/src/host.ts](client/src/host.ts), today only `fetch`). ESLint forbids Node builtins and runtime globals (`process`, `window`, `localStorage`, even global `fetch`, ...) in `client/src`, and no tsconfig ever gets the `"dom"` lib. Grow the host only when the core needs a new capability.
2. **The server boundary is the typed API.** Server imports in `client/src` are type-only (ESLint-enforced), and the zone rule limits even those to `import type { AppType } from "src/app.ts"`; requests go through `hc<AppType>` over the host's fetch. Never import server services, db, or entities into the client.
3. **Failures follow the contract**: authentication failures are state (`auth.error`, via a `sign-in-failed` event), never thrown; other API failures throw `ApiError` ([client/src/errors.ts](client/src/errors.ts)). Nothing else throws past an action. State holds one organization's collections at a time — an event scoped to a different organization resets the org slices (see `scoped` in the projection).
4. **Client logic is tested in Node against the real server** via the kit in [client/tests/kit](client/tests/kit): the `it` from [client/tests/kit/fixtures.ts](client/tests/kit/fixtures.ts) provides a per-test `world` (real Better Auth over PGlite, real committed migrations). By default all stories share one real HTTP server booted once in [client/tests/kit/global-setup.ts](client/tests/kit/global-setup.ts); `CLIENT_WORLD=in-process` switches to a private in-process world per test (no network — useful when a story needs an untouched database). `world.newClient()` is one simulated device; `world.signedUpUser()` is a signed-in persona. Write user stories against actions and `getState()` — never mock the API. Grow the kit with domain vocabulary (persona and scenario helpers), not abstraction.
5. **Client story tests run concurrently and never use fixed identifiers.** The universe is shared, so isolation comes from fresh identities: take emails from `world.uniqueEmail(...)` or `world.signedUpUser()`, always use `it.concurrent`, and take `expect` from the test context (`async ({ world, expect }) => ...`). Assert only on state the test's own users can see.
6. **The client API is documented as an OKF wiki** in [docs/client](docs/client/index.md) — one markdown concept per namespace/idea, YAML frontmatter, relative links. When you change the client's surface (action, event, state slice, host capability), update the matching page in the same change.

The backoffice operator console ([backoffice](backoffice), see [docs/backoffice.md](docs/backoffice.md)) follows the same rules and does not duplicate the client: [backoffice/core](backoffice/core) composes `createClientCore` for all client-side operations (auth included) and adds only the platform-admin actions/state, under the identical no-globals/type-only-server-imports lint block (zone-enforced); its React UI in [backoffice/ui](backoffice/ui) owns no logic.

## Style

Prettier and ESLint own formatting; don't hand-format or add disable comments to get green.

- Full words for identifiers: `context` not `c`, `transaction` not `tx`, `organization` not `org`.
- `type`, not `interface`. Files kebab-case; entity modules singular (`work-session.ts`).
- No comments restating the code. Comment only non-obvious _why_.
- Explicit return shapes over `Record<string, unknown>` or `any`. `as unknown as` belongs in test stubs, not `src/`.
- **Single-responsibility files.** One module owns one concern — a service per aggregate, an entity module per entity, a test file per subject. When a file starts serving two concerns, split it instead of growing it.
- **YAGNI.** Build only what the current feature needs: no speculative options, abstraction layers, or "for later" parameters. Generality gets added when the second caller arrives, not before.

## Testing

Unit-test schemas, policy, and crypto without a database; test routes through `createApp(dependencies)` against the in-process Postgres from [tests/helpers/harness.ts](tests/helpers/harness.ts) (PGlite with the real migrations applied — no external services needed). A new endpoint needs the authorized path, the `403`, and the cross-organization `404` covered.

The `DATABASE_URL`-gated integration test additionally runs against real Postgres and silently skips without it — a skipped suite is not a passing one. Coverage thresholds in [vitest.config.ts](vitest.config.ts) are floors: add tests, never lower them.

Run `pnpm check` before calling work done.
