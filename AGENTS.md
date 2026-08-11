# AGENTS.md

Conventions for changing this codebase. Setup and commands: [README.md](./README.md). Domain model: [docs/domain.md](./docs/domain.md). Deployment and operations: [docs/deployment.md](./docs/deployment.md).

Apps are generated from this boilerplate and inherit whatever you leave here, so fix the general pattern rather than one call site.

## Rules

1. **Relative imports carry the `.js` extension** — `from "../db/schema.js"`, even for a `.ts` file. Native ESM.
2. **Authorization lives in services, not middleware.** Every read or mutation of an organization-owned resource calls `requireOrganizationPermission` from [domain-server/services/policy.ts](domain-server/services/policy.ts) first; middleware only establishes identity.
3. **`organizationId` comes from the validated route parameter**, never from session state, and every organization-scoped query filters on it — including updates and deletes, so an id from another organization gets `404` instead of acting on its row.
4. **Throw `AppError`** ([domain-server/errors.ts](domain-server/errors.ts)), never bare `Error`, and never put SQL, credentials, stack traces, or upstream exception text in a message.
5. **Zod validates both directions**: `zValidator` on input, `responseSchema.parse(...)` before `context.json(...)`. Types are not runtime validation. Better Auth's own endpoints keep Better Auth's response format.
6. **Dependencies are injected, never module singletons.** Services take `db` first; routes read `RuntimeDependencies` off the context. This is what lets [domain-server/tests/api.test.ts](domain-server/tests/api.test.ts) run the whole stack with stubs and no database.
7. **Layering is one-directional**: routes → services → db. No Drizzle in routes, no Hono `Context` in services.
8. **Schema changes go through migrations**: edit `domain-server/db/schema.ts`, `pnpm db:generate`, review the SQL, commit it. Never `drizzle-kit push`, never hand-edit a committed migration.
9. **New environment variables go in [domain-server/config/env.ts](domain-server/config/env.ts) and `.env.example`** with a placeholder, never a real secret. Don't read `process.env` elsewhere.
10. **Log through the injected `Logger`** ([domain-server/logging.ts](domain-server/logging.ts)), never `console` — it honours `LOG_LEVEL`, takes structured fields rather than interpolated strings, and `child()` stamps a job's identifiers onto every line. Long-running work also reports progress to its caller so the API can answer "what is happening right now", not just the terminal.
11. **Job handlers are idempotent** — retries and concurrent claims are expected; see the claim-by-status-update in [domain-server/jobs/materialize.ts](domain-server/jobs/materialize.ts). Payloads get a Zod schema; producers and workers stay in separate modules.
12. **Keep `AppType` usable.** `app.ts` exports it for Hono's `hc<AppType>(baseUrl)` client, so routes need types precise enough for consumers.

## Headless client

The application client lives in [domain-client](domain-client) and is **headless by principle: all client logic is actions and state — rendering is never required to run it.** The decoupling is event-driven: actions call the API and dispatch `ClientEvent` facts ([domain-client/events.ts](domain-client/events.ts)); the projection ([domain-client/projection.ts](domain-client/projection.ts)) is the ONE place state changes — a pure `reduce(state, event)` fold. `createClientCore` ([domain-client/index.ts](domain-client/index.ts)) composes one action namespace per aggregate (`auth`, `organizations`, `sources`, ...; one module per aggregate, mirroring the service-per-aggregate layout) around the store (`getState`/`subscribe`); any UI (React, CLI, TUI) is a thin adapter that subscribes to state and calls actions, and owns no logic. Rules:

1. **No environment coupling — everything environmental enters through the `Host`** ([domain-client/host.ts](domain-client/host.ts), today only `fetch`). ESLint forbids Node builtins and runtime globals (`process`, `window`, `localStorage`, even global `fetch`, ...) in `domain-client`, and no tsconfig ever gets the `"dom"` lib. Grow the host only when the core needs a new capability.
2. **The server boundary is the typed API.** Server imports in `domain-client` are type-only (ESLint-enforced), and the zone rule limits even those to `import type { AppType } from "domain-server/app.ts"`; requests go through `hc<AppType>` over the host's fetch. Never import server services, db, or entities into the client.
3. **Failures follow the contract**: authentication failures are state (`auth.error`, via a `sign-in-failed` event), never thrown; other API failures throw `ApiError` ([domain-client/errors.ts](domain-client/errors.ts)). Nothing else throws past an action. State holds one organization's collections at a time — an event scoped to a different organization resets the org slices (see `scoped` in the projection).
4. **Client logic is tested in Node against the real server** via the kit in [domain-client/tests/kit](domain-client/tests/kit): the `it` from [domain-client/tests/kit/fixtures.ts](domain-client/tests/kit/fixtures.ts) provides a per-test `world` (real Better Auth over PGlite, real committed migrations). By default all stories share one real HTTP server booted once in [domain-client/tests/kit/global-setup.ts](domain-client/tests/kit/global-setup.ts); `CLIENT_WORLD=in-process` switches to a private in-process world per test (no network — useful when a story needs an untouched database). `world.newClient()` is one simulated device; `world.signedUpUser()` is a signed-in persona. Write user stories against actions and `getState()` — never mock the API. Grow the kit with domain vocabulary (persona and scenario helpers), not abstraction.
5. **Client story tests run concurrently and never use fixed identifiers.** The universe is shared, so isolation comes from fresh identities: take emails from `world.uniqueEmail(...)` or `world.signedUpUser()`, always use `it.concurrent`, and take `expect` from the test context (`async ({ world, expect }) => ...`). Assert only on state the test's own users can see.
6. **UI state lives in the store too — no `useState` for anything the core could hold.** Form drafts, filters, editor open/closed, and mutation errors are state slices changed by events, so every user flow (fill draft → submit → error or fresh list) is testable in Node without rendering. A React component holds no state of its own: it reads the store and dispatches actions.
7. **The client API is documented as an OKF wiki** in [docs/client](docs/client/index.md) — one markdown concept per namespace/idea, YAML frontmatter, relative links. When you change the client's surface (action, event, state slice, host capability), update the matching page in the same change.

The backoffice operator console ([backoffice](backoffice), see [docs/backoffice.md](docs/backoffice.md)) follows the same rules and does not duplicate the client: [backoffice/core](backoffice/core) composes `createClientCore` for all client-side operations (auth included) and adds only the platform-admin actions/state, under the identical no-globals/type-only-server-imports lint block (zone-enforced); its React UI in [backoffice/ui](backoffice/ui) owns no logic.

## The app

The product front end lives in [app](app) (see [docs/app.md](docs/app.md)): the public home page, sign-up, sign-in, and the pages behind the login. It follows the headless rules above and composes — never duplicates — the client core: [app/client](app/client) wraps `createClientCore` and adds only what a product UI needs, [app/ui](app/ui) is a React adapter that owns no logic, and [app/server](app/server) is the Node-side glue (dev-server port, production static shell). Rules:

1. **The route is state, and the URL is its projection.** Routes are values ([app/client/router.ts](app/client/router.ts)); the shared routing loop is [domain-client/navigation.ts](domain-client/navigation.ts) over the `History` boundary ([domain-client/history.ts](domain-client/history.ts)) — the app and the backoffice both use it, and neither parses locations in the UI.
2. **The login guard is a pure projection, not a redirect.** `visibleRoute` ([app/client/selectors.ts](app/client/selectors.ts)) decides what an anonymous visitor sees while the URL keeps pointing at the page they asked for, so signing in lands them there. `state.sessionResolved` gates the first render: until `session.load()` answers, no page is chosen.
3. **Every action goes through `attempt`** ([app/client/attempt.ts](app/client/attempt.ts)): an `ApiError` becomes `state.error` because a UI cannot handle a throw, and an `AUTHENTICATION_REQUIRED` re-resolves the session instead of showing a message.
4. **The app's slices layer over the client core's** as one tree with one subscription ([app/client/store.ts](app/client/store.ts)). `getState()` returns a cached snapshot — React's `useSyncExternalStore` requires it, so never build a fresh object in a selector.
5. **The composition root owns the mount.** [domain-server/server.ts](domain-server/server.ts) wraps the API in the app's static shell ([app/server/web.ts](app/server/web.ts)) so app and API share one origin (first-party cookie, no CORS); `domain-server/` itself knows nothing about the app, and zone rules keep it that way.
6. **UI flows are tested as stories in Node** through the client's world kit, via `visit()` ([app/tests/harness.ts](app/tests/harness.ts)) — one browser with its own cookie jar and history. Nothing about a page should need a browser to test.

## Style

Prettier and ESLint own formatting; don't hand-format or add disable comments to get green.

- Full words for identifiers: `context` not `c`, `transaction` not `tx`, `organization` not `org`.
- `type`, not `interface`. Files kebab-case; entity modules singular (`work-session.ts`).
- No comments restating the code. Comment only non-obvious _why_.
- Explicit return shapes over `Record<string, unknown>` or `any`. `as unknown as` belongs in test stubs, not `domain-server/`.
- **Single-responsibility files.** One module owns one concern — a service per aggregate, an entity module per entity, a test file per subject. When a file starts serving two concerns, split it instead of growing it.
- **YAGNI.** Build only what the current feature needs: no speculative options, abstraction layers, or "for later" parameters. Generality gets added when the second caller arrives, not before.

## Testing

Unit-test schemas, policy, and crypto without a database; test routes through `createApp(dependencies)` against the in-process Postgres from [domain-server/tests/helpers/harness.ts](domain-server/tests/helpers/harness.ts) (PGlite with the real migrations applied — no external services needed). A new endpoint needs the authorized path, the `403`, and the cross-organization `404` covered.

The `DATABASE_URL`-gated integration test additionally runs against real Postgres and silently skips without it — a skipped suite is not a passing one. Coverage thresholds in [vitest.config.ts](vitest.config.ts) are floors: add tests, never lower them.

Run `pnpm check` before calling work done.
