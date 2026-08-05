# AGENTS.md

Conventions for changing this codebase. Setup and commands: [README.md](./README.md). Domain model: [domain.md](./domain.md). Deployment and operations: [docs/deployment.md](./docs/deployment.md).

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

## Style

Prettier and ESLint own formatting; don't hand-format or add disable comments to get green.

- Full words for identifiers: `context` not `c`, `transaction` not `tx`, `organization` not `org`.
- `type`, not `interface`. Files kebab-case; entity modules singular (`work-session.ts`).
- No comments restating the code. Comment only non-obvious _why_.
- Explicit return shapes over `Record<string, unknown>` or `any`. `as unknown as` belongs in test stubs, not `src/`.

## Testing

Unit-test schemas, policy, and crypto without a database; integration-test routes through `createApp(dependencies)`. A new endpoint needs the authorized path, the `403`, and the cross-organization `404` covered.

Integration tests silently skip without `DATABASE_URL` — a skipped suite is not a passing one. Coverage thresholds in [vitest.config.ts](vitest.config.ts) are floors: add tests, never lower them.

Run `pnpm check` before calling work done.
