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
	entities/       # Entity definitions and configuration
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
- A test setup for API and entity configuration tests
- A start command for the built production server and a dev command with reload

## Entity configuration

Each API-facing entity has a typed configuration containing its name, creation-input schema, and optional relations:

```ts
import { z } from "zod";

export type EntityConfig<TCreateSchema extends z.ZodObject<z.ZodRawShape>> = {
  name: string;
  createSchema: TCreateSchema;
  relations?: Record<string, string>;
};
```

The boilerplate must support registering, validating, and retrieving entity configurations without coupling the registry to HTTP routes or database tables. The Zod schema validates API creation input; it does not define the persisted record. Drizzle tables define persistence separately.

## Type-safe database and API

Use explicit schemas for each entity instead of `Record<string, unknown>` for persisted data.

- **Database**: Use PostgreSQL in every environment, with Drizzle ORM and the `postgres` driver. Define tables in `src/db/schema.ts`, generate migrations from those definitions, and derive database select and insert types with Drizzle.
- **Runtime validation**: Use Zod schemas for request bodies, route parameters, environment variables, and API responses. TypeScript types alone do not validate incoming data.
- **API**: Define Hono routes with typed Zod validators and typed response status codes. Export the Hono app type and use Hono's `hc` client for type-safe API consumers.
- **Services**: Accept and return domain types, and keep Drizzle queries inside services or repositories. Routes should translate validated HTTP input into service calls.

Example:

```ts
// src/entities/organization.ts
import { z } from "zod";
import type { EntityConfig } from "./config";

export const organizationCreateSchema = z.object({
  name: z.string().min(1),
});

export const organizationConfig = {
  name: "organization",
  createSchema: organizationCreateSchema,
} satisfies EntityConfig<typeof organizationCreateSchema>;

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
import { organizationCreateSchema } from "../entities/organization";
import { createOrganization } from "../services/organizations";

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

```ts
// src/server.ts
import { Hono } from "hono";
import { organizationRoutes } from "./routes/organizations";

const app = new Hono().route("/organizations", organizationRoutes);

export type AppType = typeof app;
```

The generated app should export the type of its composed Hono application from the server package. A TypeScript client can then use `hc<AppType>(baseUrl)` so endpoint paths, inputs, and response types are checked at compile time.

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
- **User**: An individual who can belong to multiple organizations and manage their workspaces and work sessions according to membership permissions.
- **Source**: A Git repository, database, or other data source definition used by a workspace.
- **Workspace**: A configuration that combines source definitions for creating a work session.
- **WorkSession**: A session created by materializing the sources configured by a workspace.
- **OrganizationData**: Organization-specific configuration or preferences available to work sessions.
- **UserData**: User-specific configuration or preferences available to work sessions.

## Out of scope

A client application is an extension point for each app created from the boilerplate.
