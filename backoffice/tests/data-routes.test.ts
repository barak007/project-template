import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "../../domain-server/db/client.js";
import {
  organizationSecrets,
  session,
  sources,
} from "../../domain-server/db/schema.js";
import {
  asUser,
  createTestDatabase,
  createTestUser,
  jsonBody,
} from "../../domain-server/tests/helpers/harness.js";

import {
  backofficeSessionCookie,
  createBackofficeTestApp,
  withCookie,
} from "./harness.js";

let db: Database;
let close: () => Promise<void>;
let app: ReturnType<typeof createBackofficeTestApp>["app"];
let adminCookie = "";

const founder = "data-founder";
let organizationId = "";

function rowsUrl(table: string, query: Record<string, string> = {}): string {
  const params = new URLSearchParams(query).toString();
  return `/backoffice/data/tables/${table}/rows${params ? `?${params}` : ""}`;
}

function withJson(cookie: string, method: string, body: unknown): RequestInit {
  return withCookie(cookie, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function json<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

type Row = Record<string, unknown>;
type Page = { rows: Row[]; total: number; limit: number; offset: number };

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  ({ app } = createBackofficeTestApp(db));
  await createTestUser(db, founder);
  adminCookie = await backofficeSessionCookie(app);

  const created = await app.request(
    "/api/organizations",
    asUser(founder, jsonBody({ name: "Data Tenant" })),
  );
  expect(created.status).toBe(201);
  organizationId = (await json<{ id: string }>(created)).id;

  await db.insert(sources).values([
    {
      organizationId,
      name: "alpha-repo",
      kind: "git",
      config: { url: "https://example.test/alpha.git" },
    },
    {
      organizationId,
      name: "beta-db",
      kind: "database",
      config: { host: "db.example.test" },
    },
  ]);
  await db.insert(session).values({
    id: "session-1",
    token: "super-secret-token",
    userId: founder,
    expiresAt: new Date(Date.now() + 3_600_000),
  });
  await db.insert(organizationSecrets).values({
    organizationId,
    key: "API_KEY",
    encryptedValue: "encrypted-material",
  });
});

afterAll(async () => {
  await close();
});

describe("GET /backoffice/data/tables", () => {
  it("lists every schema table with column metadata", async () => {
    const response = await app.request(
      "/backoffice/data/tables",
      withCookie(adminCookie),
    );
    expect(response.status).toBe(200);
    const tables =
      await json<{ name: string; primaryKey: string[] }[]>(response);
    expect(tables.map((table) => table.name)).toEqual(
      expect.arrayContaining([
        "user",
        "session",
        "account",
        "verification",
        "organizations",
        "organization_members",
        "sources",
        "workspaces",
        "workspace_sources",
        "organization_secrets",
        "user_secrets",
        "organization_data",
        "user_data",
        "work_sessions",
      ]),
    );
  });

  it("marks composite primary keys and redacted columns", async () => {
    const response = await app.request(
      "/backoffice/data/tables",
      withCookie(adminCookie),
    );
    const tables = await json<
      {
        name: string;
        primaryKey: string[];
        columns: { key: string; redacted: boolean; enumValues?: string[] }[];
      }[]
    >(response);
    const members = tables.find((t) => t.name === "organization_members");
    expect(members?.primaryKey.sort()).toEqual(["organizationId", "userId"]);
    expect(members?.columns.find((c) => c.key === "role")?.enumValues).toEqual([
      "owner",
      "admin",
      "member",
    ]);
    const sessions = tables.find((t) => t.name === "session");
    expect(sessions?.columns.find((c) => c.key === "token")?.redacted).toBe(
      true,
    );
  });

  it("exposes foreign keys as column references with delete behavior", async () => {
    const response = await app.request(
      "/backoffice/data/tables",
      withCookie(adminCookie),
    );
    const tables = await json<
      {
        name: string;
        columns: {
          key: string;
          references?: { table: string; column: string; onDelete?: string };
        }[];
      }[]
    >(response);

    const accounts = tables.find((table) => table.name === "account");
    expect(
      accounts?.columns.find((column) => column.key === "userId")?.references,
    ).toEqual({ table: "user", column: "id", onDelete: "cascade" });

    const workSessions = tables.find((table) => table.name === "work_sessions");
    expect(
      workSessions?.columns.find((column) => column.key === "createdByUserId")
        ?.references,
    ).toEqual({ table: "user", column: "id", onDelete: "restrict" });
    expect(
      workSessions?.columns.find((column) => column.key === "workspaceId")
        ?.references,
    ).toEqual({ table: "workspaces", column: "id", onDelete: "restrict" });

    // Non-FK columns carry no reference.
    const users = tables.find((table) => table.name === "user");
    expect(
      users?.columns.find((column) => column.key === "email")?.references,
    ).toBeUndefined();
  });

  it("returns 401 for anonymous and application-user requests", async () => {
    expect((await app.request("/backoffice/data/tables")).status).toBe(401);
    expect(
      (await app.request("/backoffice/data/tables", asUser(founder))).status,
    ).toBe(401);
  });
});

describe("GET /backoffice/data/tables/:table/rows", () => {
  it("returns rows with a total and JSON-safe values", async () => {
    const response = await app.request(
      rowsUrl("organizations"),
      withCookie(adminCookie),
    );
    expect(response.status).toBe(200);
    const page = await json<Page>(response);
    expect(page.total).toBeGreaterThanOrEqual(1);
    const row = page.rows.find((entry) => entry.id === organizationId);
    expect(row).toMatchObject({ name: "Data Tenant" });
    expect(typeof row?.createdAt).toBe("string");
  });

  it("sorts by any column in either direction", async () => {
    const ascending = await json<Page>(
      await app.request(
        rowsUrl("sources", { sort: "name", dir: "asc" }),
        withCookie(adminCookie),
      ),
    );
    expect(ascending.rows.map((row) => row.name)).toEqual([
      "alpha-repo",
      "beta-db",
    ]);
    const descending = await json<Page>(
      await app.request(
        rowsUrl("sources", { sort: "name", dir: "desc" }),
        withCookie(adminCookie),
      ),
    );
    expect(descending.rows.map((row) => row.name)).toEqual([
      "beta-db",
      "alpha-repo",
    ]);
  });

  it("paginates with limit and offset", async () => {
    const page = await json<Page>(
      await app.request(
        rowsUrl("sources", {
          sort: "name",
          dir: "asc",
          limit: "1",
          offset: "1",
        }),
        withCookie(adminCookie),
      ),
    );
    expect(page.rows.map((row) => row.name)).toEqual(["beta-db"]);
    expect(page.total).toBe(2);
  });

  it("filters with contains, eq, and date comparisons", async () => {
    const contains = await json<Page>(
      await app.request(
        rowsUrl("sources", {
          filters: JSON.stringify([
            { column: "name", op: "contains", value: "ALPHA" },
          ]),
        }),
        withCookie(adminCookie),
      ),
    );
    expect(contains.rows.map((row) => row.name)).toEqual(["alpha-repo"]);

    const byKind = await json<Page>(
      await app.request(
        rowsUrl("sources", {
          filters: JSON.stringify([
            { column: "kind", op: "eq", value: "database" },
          ]),
        }),
        withCookie(adminCookie),
      ),
    );
    expect(byKind.rows.map((row) => row.name)).toEqual(["beta-db"]);

    const future = await json<Page>(
      await app.request(
        rowsUrl("sources", {
          filters: JSON.stringify([
            {
              column: "createdAt",
              op: "gte",
              value: new Date(Date.now() + 3_600_000).toISOString(),
            },
          ]),
        }),
        withCookie(adminCookie),
      ),
    );
    expect(future.total).toBe(0);
  });

  it("redacts secret material and rejects filtering on it", async () => {
    const sessions = await json<Page>(
      await app.request(rowsUrl("session"), withCookie(adminCookie)),
    );
    expect(sessions.rows[0]?.token).toBe("[redacted]");
    const body = JSON.stringify(sessions.rows);
    expect(body).not.toContain("super-secret-token");

    const secrets = await json<Page>(
      await app.request(
        rowsUrl("organization_secrets"),
        withCookie(adminCookie),
      ),
    );
    expect(secrets.rows[0]?.encryptedValue).toBe("[redacted]");

    const filtered = await app.request(
      rowsUrl("session", {
        filters: JSON.stringify([
          { column: "token", op: "contains", value: "super" },
        ]),
      }),
      withCookie(adminCookie),
    );
    expect(filtered.status).toBe(400);
  });

  it("supports ne, lt, and null / not-null operators", async () => {
    const notGit = await json<Page>(
      await app.request(
        rowsUrl("sources", {
          filters: JSON.stringify([{ column: "kind", op: "ne", value: "git" }]),
        }),
        withCookie(adminCookie),
      ),
    );
    expect(notGit.rows.map((row) => row.name)).toEqual(["beta-db"]);

    const past = await json<Page>(
      await app.request(
        rowsUrl("sources", {
          filters: JSON.stringify([
            {
              column: "createdAt",
              op: "lt",
              value: new Date(Date.now() - 3_600_000).toISOString(),
            },
          ]),
        }),
        withCookie(adminCookie),
      ),
    );
    expect(past.total).toBe(0);

    const noImage = await json<Page>(
      await app.request(
        rowsUrl("user", {
          filters: JSON.stringify([{ column: "image", op: "null" }]),
        }),
        withCookie(adminCookie),
      ),
    );
    expect(noImage.rows.map((row) => row.id)).toContain(founder);

    const withImage = await json<Page>(
      await app.request(
        rowsUrl("user", {
          filters: JSON.stringify([{ column: "image", op: "not-null" }]),
        }),
        withCookie(adminCookie),
      ),
    );
    expect(withImage.total).toBe(0);
  });

  it("rejects type-mismatched and unsupported filters", async () => {
    const badFilter = async (table: string, filter: unknown) =>
      (
        await app.request(
          rowsUrl(table, { filters: JSON.stringify([filter]) }),
          withCookie(adminCookie),
        )
      ).status;

    // contains on a non-text column
    expect(
      await badFilter("user", {
        column: "emailVerified",
        op: "contains",
        value: "yes",
      }),
    ).toBe(400);
    // comparison on a json column
    expect(
      await badFilter("sources", { column: "config", op: "eq", value: {} }),
    ).toBe(400);
    // wrong value type for the column
    expect(
      await badFilter("sources", { column: "name", op: "eq", value: 5 }),
    ).toBe(400);
    // value outside the enum
    expect(
      await badFilter("sources", { column: "kind", op: "eq", value: "nope" }),
    ).toBe(400);
    // missing value for a comparison
    expect(await badFilter("sources", { column: "name", op: "eq" })).toBe(400);
    // sorting on a redacted column
    expect(
      (
        await app.request(
          rowsUrl("session", { sort: "token" }),
          withCookie(adminCookie),
        )
      ).status,
    ).toBe(400);
  });

  it("rejects unknown tables, columns, and malformed filters", async () => {
    expect(
      (await app.request(rowsUrl("no_such_table"), withCookie(adminCookie)))
        .status,
    ).toBe(404);
    expect(
      (
        await app.request(
          rowsUrl("organizations", { sort: "nope" }),
          withCookie(adminCookie),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await app.request(
          rowsUrl("organizations", { filters: "not-json" }),
          withCookie(adminCookie),
        )
      ).status,
    ).toBe(400);
  });
});

describe("row mutations", () => {
  it("inserts, updates, and deletes a row", async () => {
    const created = await app.request(
      rowsUrl("organizations"),
      withJson(adminCookie, "POST", { values: { name: "Managed Tenant" } }),
    );
    expect(created.status).toBe(201);
    const row = await json<Row>(created);
    expect(row.name).toBe("Managed Tenant");
    const id = row.id as string;

    const updated = await app.request(
      rowsUrl("organizations"),
      withJson(adminCookie, "PATCH", {
        key: { id },
        values: { name: "Renamed Tenant" },
      }),
    );
    expect(updated.status).toBe(200);
    expect((await json<Row>(updated)).name).toBe("Renamed Tenant");

    const deleted = await app.request(
      rowsUrl("organizations"),
      withJson(adminCookie, "DELETE", { key: { id } }),
    );
    expect(deleted.status).toBe(204);

    const gone = await app.request(
      rowsUrl("organizations"),
      withJson(adminCookie, "DELETE", { key: { id } }),
    );
    expect(gone.status).toBe(404);
  });

  it("updates a composite-key row", async () => {
    const updated = await app.request(
      rowsUrl("organization_members"),
      withJson(adminCookie, "PATCH", {
        key: { organizationId, userId: founder },
        values: { role: "admin" },
      }),
    );
    expect(updated.status).toBe(200);
    expect((await json<Row>(updated)).role).toBe("admin");
  });

  it("rejects missing required columns, primary-key updates, and redacted writes", async () => {
    const missing = await app.request(
      rowsUrl("organizations"),
      withJson(adminCookie, "POST", { values: {} }),
    );
    expect(missing.status).toBe(400);

    const keyUpdate = await app.request(
      rowsUrl("organizations"),
      withJson(adminCookie, "PATCH", {
        key: { id: organizationId },
        values: { id: "00000000-0000-4000-8000-000000000001" },
      }),
    );
    expect(keyUpdate.status).toBe(400);

    const redactedWrite = await app.request(
      rowsUrl("organization_secrets"),
      withJson(adminCookie, "POST", {
        values: { organizationId, key: "X", encryptedValue: "boom" },
      }),
    );
    expect(redactedWrite.status).toBe(400);
  });

  it("rejects malformed keys, empty updates, and bad value types", async () => {
    // key that is not the full primary key
    const partialKey = await app.request(
      rowsUrl("organization_members"),
      withJson(adminCookie, "PATCH", {
        key: { organizationId },
        values: { role: "member" },
      }),
    );
    expect(partialKey.status).toBe(400);

    // nothing to update
    const empty = await app.request(
      rowsUrl("organizations"),
      withJson(adminCookie, "PATCH", {
        key: { id: organizationId },
        values: {},
      }),
    );
    expect(empty.status).toBe(400);

    // update for a row that does not exist
    const missingRow = await app.request(
      rowsUrl("organizations"),
      withJson(adminCookie, "PATCH", {
        key: { id: "00000000-0000-4000-8000-000000000999" },
        values: { name: "Ghost" },
      }),
    );
    expect(missingRow.status).toBe(404);

    // a date column fed a non-date value
    const badDate = await app.request(
      rowsUrl("user"),
      withJson(adminCookie, "PATCH", {
        key: { id: founder },
        values: { createdAt: "not-a-date" },
      }),
    );
    expect(badDate.status).toBe(400);

    // a boolean column fed a string
    const badBoolean = await app.request(
      rowsUrl("user"),
      withJson(adminCookie, "PATCH", {
        key: { id: founder },
        values: { emailVerified: "yes" },
      }),
    );
    expect(badBoolean.status).toBe(400);
  });

  it("updates boolean and date columns with proper values", async () => {
    const verified = await app.request(
      rowsUrl("user"),
      withJson(adminCookie, "PATCH", {
        key: { id: founder },
        values: { emailVerified: true },
      }),
    );
    expect(verified.status).toBe(200);
    expect((await json<Row>(verified)).emailVerified).toBe(true);
  });

  it("maps constraint violations to conflicts", async () => {
    const duplicate = await app.request(
      rowsUrl("sources"),
      withJson(adminCookie, "POST", {
        values: {
          organizationId,
          name: "alpha-repo",
          kind: "git",
          config: {},
        },
      }),
    );
    expect(duplicate.status).toBe(409);
  });

  it("requires the backoffice session", async () => {
    const response = await app.request(rowsUrl("organizations"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ values: { name: "Nope" } }),
    });
    expect(response.status).toBe(401);
  });
});
