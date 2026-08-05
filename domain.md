# Application Boilerplate Template

## Purpose

A reusable starting point for Node.js applications whose domains are defined through entities. The template provides an HTTP API, persistence, authentication, background jobs, and development tooling, but no client rendering framework.

## Stack

- Node.js runtime
- TypeScript
- Hono for the API server
- Vite for Hono development and production builds
- No client rendering library; UI rendering is added by each generated app when needed

## Minimal structure

```text
src/
  server.ts       # Hono application and Node.js server entry point
	routes/         # HTTP route handlers
  entities/       # Entity validation schemas and types
	services/       # Domain operations
	config/         # Environment and application configuration
tests/
```

The boilerplate must include:

- TypeScript configuration with strict type checking
- Vite development and production build configuration for Hono on Node.js
- Hono health endpoint: `GET /health`
- Environment loading and validation
- A consistent error response format
- A test setup for API and entity schema tests
- A start command for the built production server and a dev command with reload

## Project quality and delivery

Quality checks and deployment are part of the initial boilerplate, not follow-up work.

### Local developer experience

- Use one package manager and commit its lockfile. CI and container builds must use frozen-lockfile installs.
- Commit an `.editorconfig` and repository ignore files so editors, builds, tests, and containers share consistent whitespace and exclusions.
- Configure ESLint with the TypeScript ESLint recommended type-checked rules and import hygiene rules.
- Configure Prettier and keep formatting separate from linting.
- Provide `dev`, `build`, `start`, `typecheck`, `lint`, `lint:fix`, `format`, `format:check`, `test`, `test:watch`, and `test:coverage` package scripts.
- Add a `check` script that runs formatting, linting, type checking, tests, and the production build in the same order as CI.
- Use a supported Node.js version declared in both the package manifest and a version file. Keep local, CI, and production versions aligned.
- Commit `.env.example` with names and safe example values only. Validate all environment variables at process startup.
- Provide Docker Compose for the local PostgreSQL dependency and scripts for migrations, test database setup, and deterministic seed data.
- Configure dependency update automation and keep updates grouped so the full CI suite evaluates them together.

### Continuous integration

Use GitHub Actions for pull requests and the default branch. CI must:

1. Install dependencies from the lockfile with caching.
2. Check formatting and linting.
3. Run the TypeScript type checker.
4. Start an isolated PostgreSQL service, apply committed migrations, and run unit and integration tests.
5. Build the production artifacts and container image.
6. Fail when generated Drizzle migrations or other generated artifacts are stale.

Require the CI workflow as a branch protection check. Cancel superseded runs on the same pull request, grant workflows the minimum permissions they need, and never expose deployment secrets to workflows for untrusted forks.

### Deployment from day one

- Include a production, multi-stage Dockerfile with a non-root runtime user and only runtime dependencies in the final image.
- Define the API and worker as separate processes built from the same revision and image.
- Provision services, PostgreSQL, environment variables, health checks, and scaling settings through version-controlled infrastructure configuration rather than dashboard-only setup.
- Deploy the default branch automatically to a production environment after CI succeeds. Protect production with the hosting provider's environment controls.
- Run committed Drizzle migrations as a one-off release step before starting the new API and worker revision. A migration failure must stop the deployment.
- Use `GET /health` for liveness and add a readiness check that verifies startup dependencies without exposing sensitive details.
- Handle `SIGTERM`, stop accepting requests, drain in-flight work, close database and queue connections, and exit within the platform's shutdown window.
- Store secrets in the deployment platform's secret manager. Never bake them into images, build arguments, logs, or repository configuration.
- Enable centralized logs, error reporting, uptime monitoring, and alerts for failed deployments and unhealthy production services.
- Document the initial deployment and rollback procedure in the repository.

### Pull request preview environments

Every pull request from a trusted branch gets an automatically created preview environment:

- Deploy the API and worker from the pull request revision and publish the preview URL on the pull request.
- Provision an isolated PostgreSQL database, apply migrations, and optionally load non-sensitive deterministic seed data. Never share the production database.
- Generate preview-specific authentication URLs, trusted origins, cookie names, and external service configuration so previews cannot collide with production.
- Disable or sandbox email, billing, webhooks, and other side effects unless a preview-safe provider is explicitly configured.
- Run a smoke test against the deployed `/health` endpoint before marking the preview successful.
- Update the same environment on later commits and destroy all preview resources when the pull request closes.
- Use least-privilege preview secrets and prevent preview workflows from receiving secrets on untrusted fork pull requests.

## Type-safe database and API

Use explicit schemas for each entity instead of `Record<string, unknown>` for persisted data.

- **Database**: Use PostgreSQL in every environment, with Drizzle ORM and the `postgres` driver. Define tables in `src/db/schema.ts`, generate migrations from those definitions, and derive database select and insert types with Drizzle.
- **Runtime validation**: Use Zod schemas for request bodies, route parameters, environment variables, and API responses. Parse service results with the endpoint's response schema before returning them. TypeScript types alone do not validate data at runtime.
- **API**: Define Hono routes with typed Zod validators and typed response status codes. Export the Hono app type and use Hono's `hc` client for type-safe API consumers.
- **Services**: Accept and return domain types, and keep Drizzle queries inside services or repositories. Routes should translate validated HTTP input into service calls.

Example:

```ts
// src/entities/organization.ts
import { z } from "zod";

export const organizationCreateSchema = z.object({
  name: z.string().min(1),
});

export const organizationResponseSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
});

export type OrganizationCreate = z.infer<typeof organizationCreateSchema>;

// src/db/schema.ts
import { pgTable, serial, text } from "drizzle-orm/pg-core";

export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
});

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
```

```ts
// src/routes/organizations.ts
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import {
  organizationCreateSchema,
  organizationResponseSchema,
} from "../entities/organization";
import { createOrganization } from "../services/organizations";

export const organizationRoutes = new Hono().post(
  "/",
  zValidator("json", organizationCreateSchema),
  async (context) => {
    const input = context.req.valid("json");
    const organization = await createOrganization(input);
    return context.json(organizationResponseSchema.parse(organization), 201);
  },
);

export type OrganizationRoutes = typeof organizationRoutes;
```

```ts
// src/server.ts
import { Hono } from "hono";
import { organizationRoutes } from "./routes/organizations";

const app = new Hono().route("/organizations", organizationRoutes);

export type AppType = typeof app;
```

The generated app should export the type of its composed Hono application from the server package. A TypeScript client can then use `hc<AppType>(baseUrl)` so endpoint paths, inputs, and response types are checked at compile time.

The database schema remains the source of truth for persistence, Zod remains the source of truth for untrusted input, and Hono route types remain the source of truth for API consumers. Changes should be made explicitly in each boundary and covered by type checks, migrations, and API tests.

### Error responses

All non-authentication API errors use this JSON envelope:

```ts
type ErrorResponse = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};
```

Define stable application error codes separately from HTTP statuses. Map validation failures to `400`, missing authentication to `401`, insufficient permission to `403`, missing records to `404`, uniqueness or state conflicts to `409`, and unexpected failures to `500`. Validation errors may include field-level information in `details`; production responses must not expose stack traces, SQL, credentials, or internal exception messages. Better Auth endpoints may retain Better Auth's response format.

### PostgreSQL configuration

- Require a validated `DATABASE_URL` environment variable in every environment.
- Use a local PostgreSQL instance through Docker Compose for development and tests.
- Create one shared connection pool at application startup and pass the Drizzle database instance to services.
- Run committed Drizzle migrations during deployment before starting the API.
- Never run schema pushes or destructive migrations automatically in production.
- Keep credentials out of the repository and use the deployment platform's secret manager.

## Authentication

Use Better Auth with its Hono integration and Drizzle adapter.

- Store users, accounts, sessions, and verification records in PostgreSQL.
- Mount the authentication routes under `/api/auth/*`.
- Add Hono middleware that resolves the current session and exposes the authenticated user to route handlers.
- Require authentication by default for domain routes; mark public routes explicitly.
- Support email and password initially. Additional identity providers are app-level configuration.
- Use secure, HTTP-only cookies and trusted origins configured through validated environment variables.

## Authorization

Authorization is organization-scoped and enforced by policy functions in the service layer, not only by route middleware.

- Store organization membership in an `organization_members` table with `organizationId`, `userId`, and `role`.
- Start with `owner`, `admin`, and `member` roles.
- Every organization-owned record must include an `organizationId`.
- Resolve the active organization from a route parameter or validated request context; never accept it implicitly from session data.
- Check membership and the required permission before every read or mutation of an organization-owned resource.
- Keep permission checks centralized, for example `requireOrganizationPermission(userId, organizationId, permission)`.
- Return `401` when no valid session exists and `403` when the user lacks permission.
- Organization creation requires authentication but cannot require existing membership. Create the organization and its initial `owner` membership atomically for the requesting user.
- Explicitly public operations, authentication operations, and reads or mutations of a user's own non-organization data are outside organization membership checks and must have their own authorization policy.

## Queues

Use `pg-boss` for durable background jobs backed by the existing PostgreSQL database.

- Define each job's input with a Zod schema and infer its TypeScript type from that schema.
- Keep producers and workers in separate modules under `src/jobs/`.
- Run workers in a separate process from the API in production.
- Configure retry limits, exponential backoff, expiration, and dead-letter handling for every job.
- Use idempotency keys for jobs that create or mutate external resources.
- Start and stop the queue and workers through application lifecycle hooks for graceful shutdown.
- Test producers with a queue adapter and integration-test workers against PostgreSQL.

## Initial entities

- **Organization**: A group of users that can own workspaces and work sessions.
- **User**: An individual who can belong to multiple organizations and manage their workspaces and work sessions according to membership permissions.
- **Source**: A Git repository, database, or other data source definition used by a workspace.
- **Workspace**: A configuration that combines source definitions for creating a work session.
- **WorkSession**: A session created by materializing the sources configured by a workspace. Creation copies the organization's secrets and the creating user's secrets into the session. User secrets override organization secrets with the same key. Later secret changes affect only future sessions.
- **OrganizationSecret**: A secret key and encrypted value stored in PostgreSQL for an organization.
- **UserSecret**: A secret key and encrypted value stored in PostgreSQL for a user.
- **OrganizationData**: Organization-specific configuration or preferences available to work sessions, stored as schema-validated key-value data with at most one value per organization and key.
- **UserData**: User-specific configuration or preferences available to work sessions, stored as schema-validated key-value data with at most one value per user and key. When both scopes define the same key, user data overrides organization data. A work session snapshots the resolved values at creation so later changes affect only future sessions.

## Out of scope

A client application is an extension point for each app created from the boilerplate.
