# Application Boilerplate

## Purpose

A reusable Node.js application template for creating apps whose domain is configured through entities. The template provides an HTTP API and development tooling, but no client rendering framework.

## Stack

- Node.js runtime
- TypeScript
- Hono for the API server
- Vite for development and build tooling
- No client rendering library; UI rendering is added by each generated app when needed

## Minimal structure

```text
src/
	server.ts       # Hono application and server entry point
	routes/         # HTTP route handlers
	entities/       # Entity definitions and configuration
	services/       # Domain operations
	config/         # Environment and application configuration
tests/
```

The boilerplate must include:

- TypeScript configuration with strict type checking
- Vite development configuration
- Hono health endpoint: `GET /health`
- Environment loading and validation
- A consistent error response format
- A test setup for API and entity configuration tests
- A start command for production and a dev command with reload

## Entity configuration

Each entity is defined by a typed configuration containing:

```ts
type EntityConfig = {
  name: string;
  fields: Record<string, unknown>;
  relations?: Record<string, string>;
};
```

The boilerplate must support registering, validating, and retrieving entity configurations without coupling them to HTTP routes or a database. Generated applications can replace the placeholder field definitions and add persistence or business rules.

## Type-safe database and API

Use one explicit schema per entity and derive types from it instead of using `Record<string, unknown>` for persisted data.

- **Database**: Use PostgreSQL in every environment, with Drizzle ORM and the `postgres` driver. Define tables in `src/db/schema.ts`, generate migrations from those definitions, and derive database select and insert types with Drizzle.
- **Runtime validation**: Use Zod schemas for request bodies, route parameters, environment variables, and API responses. TypeScript types alone do not validate incoming data.
- **API**: Define Hono routes with typed Zod validators and typed response status codes. Export the Hono app type and use Hono's `hc` client for type-safe API consumers.
- **Services**: Accept and return domain types, and keep Drizzle queries inside services or repositories. Routes should translate validated HTTP input into service calls.

Example:

```ts
// src/entities/organization.ts
import { z } from "zod";

export const organizationCreateSchema = z.object({
  name: z.string().min(1),
});

export type OrganizationCreate = z.infer<typeof organizationCreateSchema>;

// src/db/schema.ts
import { integer, pgTable, text } from "drizzle-orm/pg-core";

export const organizations = pgTable("organizations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
});

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
```

```ts
// src/routes/organizations.ts
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { organizationCreateSchema } from "../entities/organization";

export const organizationRoutes = new Hono().post(
  "/",
  zValidator("json", organizationCreateSchema),
  async (context) => {
    const input = context.req.valid("json");
    const organization = await createOrganization(input);
    return context.json(organization, 201);
  },
);

export type OrganizationRoutes = typeof organizationRoutes;
```

The generated app should expose its route type from the server package. A TypeScript client can then use `hc<OrganizationRoutes>(baseUrl)` so endpoint paths, inputs, and response types are checked at compile time.

The database schema remains the source of truth for persistence, Zod remains the source of truth for untrusted input, and Hono route types remain the source of truth for API consumers. Changes should be made explicitly in each boundary and covered by type checks, migrations, and API tests.

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
- Check membership and the required permission before every read or mutation.
- Keep permission checks centralized, for example `requireOrganizationPermission(userId, organizationId, permission)`.
- Return `401` when no valid session exists and `403` when the user lacks permission.

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
- **User**: An individual who can manage workspaces and work sessions and belong to multiple organizations.
- **Source**: A Git repository, database, or other data source used to define a workspace and create a work session.
- **Workspace**: A configuration containing the source definitions used to create a work session.
- **WorkSession**: A session created from a workspace configuration and its sources.
- **OrganizationData**: Organization-specific data, such as credentials or preferences, available to work sessions.
- **UserData**: User-specific data, such as credentials or preferences, available to work sessions.

## Out of scope

A client application is an extension point for each app created from the boilerplate.
