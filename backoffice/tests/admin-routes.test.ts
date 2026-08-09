import { verifyPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "../../domain-server/db/client.js";
import {
  account,
  organizations,
  session,
  sources,
  user,
  workSessions,
  workspaces,
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

const founder = "founder-user";
let organizationId = "";
let workspaceId = "";

async function json(response: Response): Promise<unknown> {
  return response.json();
}

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  ({ app } = createBackofficeTestApp(db));
  await createTestUser(db, founder);
  adminCookie = await backofficeSessionCookie(app);

  const created = await app.request(
    "/api/organizations",
    asUser(founder, jsonBody({ name: "Tenant" })),
  );
  expect(created.status).toBe(201);
  organizationId = ((await json(created)) as { id: string }).id;

  await db.insert(sources).values({
    organizationId,
    name: "repo",
    kind: "git",
    config: { url: "https://example.test/repo.git", token: "sensitive" },
  });
  const workspace = await app.request(
    `/api/organizations/${organizationId}/workspaces`,
    asUser(founder, jsonBody({ name: "main" })),
  );
  expect(workspace.status).toBe(201);
  workspaceId = ((await json(workspace)) as { id: string }).id;
  await db.insert(workSessions).values({
    organizationId,
    workspaceId,
    createdByUserId: founder,
    status: "failed",
    failureCode: "MATERIALIZER_UNAVAILABLE",
    sourcesSnapshot: [],
    secretsSnapshot: { API_KEY: "encrypted-material" },
    dataSnapshot: {},
  });
});

afterAll(async () => {
  await close();
});

describe("GET /backoffice/admin/users", () => {
  it("lists every user for the backoffice admin", async () => {
    const response = await app.request(
      "/backoffice/admin/users",
      withCookie(adminCookie),
    );
    expect(response.status).toBe(200);
    const users = (await json(response)) as { id: string; email: string }[];
    expect(users.map((entry) => entry.id)).toEqual(
      expect.arrayContaining([founder]),
    );
  });

  it("returns 401 for an application-user session", async () => {
    const response = await app.request(
      "/backoffice/admin/users",
      asUser(founder),
    );
    expect(response.status).toBe(401);
    expect(await json(response)).toMatchObject({
      error: { code: "AUTHENTICATION_REQUIRED" },
    });
  });

  it("returns 401 for anonymous requests", async () => {
    const response = await app.request("/backoffice/admin/users");
    expect(response.status).toBe(401);
  });
});

describe("POST /backoffice/admin/users", () => {
  it("creates a user whose credential better-auth can verify", async () => {
    const response = await app.request(
      "/backoffice/admin/users",
      withCookie(
        adminCookie,
        jsonBody({
          name: "New User",
          email: "new-user@example.test",
          password: "a-strong-password",
        }),
      ),
    );
    expect(response.status).toBe(201);
    const created = (await json(response)) as { id: string; email: string };
    expect(created.email).toBe("new-user@example.test");

    const [credential] = await db
      .select({ providerId: account.providerId, password: account.password })
      .from(account)
      .where(eq(account.userId, created.id));
    expect(credential?.providerId).toBe("credential");
    expect(
      await verifyPassword({
        hash: credential?.password ?? "",
        password: "a-strong-password",
      }),
    ).toBe(true);

    const listed = await app.request(
      "/backoffice/admin/users",
      withCookie(adminCookie),
    );
    const users = (await json(listed)) as { id: string }[];
    expect(users.map((entry) => entry.id)).toContain(created.id);
  });

  it("never echoes the password back", async () => {
    const response = await app.request(
      "/backoffice/admin/users",
      withCookie(
        adminCookie,
        jsonBody({
          name: "Echo Check",
          email: "echo-check@example.test",
          password: "do-not-echo-me",
        }),
      ),
    );
    expect(response.status).toBe(201);
    expect(await response.text()).not.toContain("do-not-echo-me");
  });

  it("rejects a duplicate email with 409", async () => {
    const response = await app.request(
      "/backoffice/admin/users",
      withCookie(
        adminCookie,
        jsonBody({
          name: "Duplicate",
          email: `${founder}@example.test`,
          password: "a-strong-password",
        }),
      ),
    );
    expect(response.status).toBe(409);
    expect(await json(response)).toMatchObject({
      error: { code: "CONFLICT" },
    });
  });

  it("rejects a short password with 400", async () => {
    const response = await app.request(
      "/backoffice/admin/users",
      withCookie(
        adminCookie,
        jsonBody({
          name: "Weak",
          email: "weak@example.test",
          password: "short",
        }),
      ),
    );
    expect(response.status).toBe(400);
  });

  it("returns 401 for anonymous requests", async () => {
    const response = await app.request(
      "/backoffice/admin/users",
      jsonBody({
        name: "Anon",
        email: "anon@example.test",
        password: "a-strong-password",
      }),
    );
    expect(response.status).toBe(401);
  });
});

describe("GET /backoffice/admin/users/:userId", () => {
  beforeAll(async () => {
    await db.insert(account).values({
      id: "founder-credential",
      accountId: founder,
      providerId: "credential",
      userId: founder,
      password: "hash-material-must-not-leak",
    });
    await db.insert(session).values({
      id: "founder-session",
      token: "token-material-must-not-leak",
      userId: founder,
      expiresAt: new Date(Date.now() + 3_600_000),
      ipAddress: "203.0.113.7",
      userAgent: "TestBrowser/1.0",
    });
  });

  it("embeds sign-in methods, sessions, memberships, and work sessions", async () => {
    const response = await app.request(
      `/backoffice/admin/users/${founder}`,
      withCookie(adminCookie),
    );
    expect(response.status).toBe(200);
    const detail = (await json(response)) as Record<string, unknown>;
    expect(detail).toMatchObject({
      user: { id: founder, email: `${founder}@example.test` },
      accounts: [{ providerId: "credential" }],
      sessions: [{ ipAddress: "203.0.113.7", userAgent: "TestBrowser/1.0" }],
      memberships: [
        { organizationId, organizationName: "Tenant", role: "owner" },
      ],
      workSessions: [{ organizationId, workspaceId, status: "failed" }],
    });
  });

  it("never exposes password hashes, tokens, or snapshot material", async () => {
    const response = await app.request(
      `/backoffice/admin/users/${founder}`,
      withCookie(adminCookie),
    );
    const body = await response.text();
    expect(body).not.toContain("password");
    expect(body).not.toContain("hash-material-must-not-leak");
    expect(body).not.toContain("token-material-must-not-leak");
    expect(body).not.toContain("Snapshot");
    expect(body).not.toContain("encrypted-material");
  });

  it("returns 404 for an unknown user", async () => {
    const response = await app.request(
      "/backoffice/admin/users/no-such-user",
      withCookie(adminCookie),
    );
    expect(response.status).toBe(404);
  });

  it("returns 401 for anonymous requests", async () => {
    const response = await app.request(`/backoffice/admin/users/${founder}`);
    expect(response.status).toBe(401);
  });
});

describe("DELETE /backoffice/admin/users/:userId", () => {
  it("deletes a user and their credential", async () => {
    const deletable = await createTestUser(db, "deletable-user");
    const response = await app.request(
      `/backoffice/admin/users/${deletable}`,
      withCookie(adminCookie, { method: "DELETE" }),
    );
    expect(response.status).toBe(204);
    const remaining = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, deletable));
    expect(remaining).toEqual([]);
  });

  it("refuses with 409 when the user created work sessions", async () => {
    const response = await app.request(
      `/backoffice/admin/users/${founder}`,
      withCookie(adminCookie, { method: "DELETE" }),
    );
    expect(response.status).toBe(409);
    expect(await json(response)).toMatchObject({
      error: { code: "CONFLICT" },
    });
  });

  it("returns 404 for an unknown user", async () => {
    const response = await app.request(
      "/backoffice/admin/users/no-such-user",
      withCookie(adminCookie, { method: "DELETE" }),
    );
    expect(response.status).toBe(404);
  });

  it("returns 401 for anonymous requests", async () => {
    const response = await app.request(`/backoffice/admin/users/${founder}`, {
      method: "DELETE",
    });
    expect(response.status).toBe(401);
  });
});

describe("GET /backoffice/admin/organizations", () => {
  it("lists organizations the admin is not a member of", async () => {
    const response = await app.request(
      "/backoffice/admin/organizations",
      withCookie(adminCookie),
    );
    expect(response.status).toBe(200);
    const organizations = (await json(response)) as { id: string }[];
    expect(organizations.map((entry) => entry.id)).toContain(organizationId);
  });

  it("returns 401 for anonymous requests", async () => {
    const response = await app.request("/backoffice/admin/organizations");
    expect(response.status).toBe(401);
  });
});

describe("POST /backoffice/admin/organizations", () => {
  it("creates an organization visible in the list", async () => {
    const response = await app.request(
      "/backoffice/admin/organizations",
      withCookie(adminCookie, jsonBody({ name: "Created Tenant" })),
    );
    expect(response.status).toBe(201);
    const created = (await json(response)) as { id: string; name: string };
    expect(created.name).toBe("Created Tenant");

    const listed = await app.request(
      "/backoffice/admin/organizations",
      withCookie(adminCookie),
    );
    const listedOrganizations = (await json(listed)) as { id: string }[];
    expect(listedOrganizations.map((entry) => entry.id)).toContain(created.id);
  });

  it("rejects an empty name with 400", async () => {
    const response = await app.request(
      "/backoffice/admin/organizations",
      withCookie(adminCookie, jsonBody({ name: "  " })),
    );
    expect(response.status).toBe(400);
  });

  it("returns 401 for anonymous requests", async () => {
    const response = await app.request(
      "/backoffice/admin/organizations",
      jsonBody({ name: "Anon Tenant" }),
    );
    expect(response.status).toBe(401);
  });
});

describe("DELETE /backoffice/admin/organizations/:organizationId", () => {
  it("deletes an organization with workspaces and work sessions", async () => {
    // A tenant with the full restrict-prone graph: workspace + work session.
    const [organization] = await db
      .insert(organizations)
      .values({ name: "Doomed Tenant" })
      .returning({ id: organizations.id });
    if (!organization) throw new Error("insert failed");
    const [workspace] = await db
      .insert(workspaces)
      .values({ organizationId: organization.id, name: "doomed" })
      .returning({ id: workspaces.id });
    if (!workspace) throw new Error("insert failed");
    await db.insert(workSessions).values({
      organizationId: organization.id,
      workspaceId: workspace.id,
      createdByUserId: founder,
      status: "ready",
      sourcesSnapshot: [],
      secretsSnapshot: {},
      dataSnapshot: {},
    });

    const response = await app.request(
      `/backoffice/admin/organizations/${organization.id}`,
      withCookie(adminCookie, { method: "DELETE" }),
    );
    expect(response.status).toBe(204);

    expect(
      await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.id, organization.id)),
    ).toEqual([]);
    expect(
      await db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(eq(workspaces.id, workspace.id)),
    ).toEqual([]);
    expect(
      await db
        .select({ id: workSessions.id })
        .from(workSessions)
        .where(eq(workSessions.organizationId, organization.id)),
    ).toEqual([]);
  });

  it("returns 404 for an unknown organization", async () => {
    const response = await app.request(
      "/backoffice/admin/organizations/00000000-0000-4000-8000-000000000999",
      withCookie(adminCookie, { method: "DELETE" }),
    );
    expect(response.status).toBe(404);
  });

  it("returns 401 for anonymous requests", async () => {
    const response = await app.request(
      `/backoffice/admin/organizations/${organizationId}`,
      { method: "DELETE" },
    );
    expect(response.status).toBe(401);
  });
});

describe("GET /backoffice/admin/organizations/:organizationId", () => {
  it("embeds members, sources, workspaces, and work sessions", async () => {
    const response = await app.request(
      `/backoffice/admin/organizations/${organizationId}`,
      withCookie(adminCookie),
    );
    expect(response.status).toBe(200);
    const detail = (await json(response)) as Record<string, unknown>;
    expect(detail).toMatchObject({
      organization: { id: organizationId, name: "Tenant" },
      members: [
        { userId: founder, role: "owner", email: `${founder}@example.test` },
      ],
      sources: [{ name: "repo", kind: "git" }],
      workspaces: [{ id: workspaceId, name: "main" }],
      workSessions: [
        {
          workspaceId,
          createdByUserId: founder,
          status: "failed",
          failureCode: "MATERIALIZER_UNAVAILABLE",
        },
      ],
    });
  });

  it("never exposes source config or work-session snapshot material", async () => {
    const response = await app.request(
      `/backoffice/admin/organizations/${organizationId}`,
      withCookie(adminCookie),
    );
    const body = await response.text();
    expect(body).not.toContain("config");
    expect(body).not.toContain("Snapshot");
    expect(body).not.toContain("sensitive");
    expect(body).not.toContain("encrypted-material");
    expect(body).not.toContain("API_KEY");
  });

  it("returns 404 for an unknown organization", async () => {
    const response = await app.request(
      "/backoffice/admin/organizations/00000000-0000-4000-8000-000000000999",
      withCookie(adminCookie),
    );
    expect(response.status).toBe(404);
  });

  it("returns 401 for an application-user session, even a member", async () => {
    const response = await app.request(
      `/backoffice/admin/organizations/${organizationId}`,
      asUser(founder),
    );
    expect(response.status).toBe(401);
  });
});
