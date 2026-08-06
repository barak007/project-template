import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "../src/db/client.js";
import { platformAdmins, sources, workSessions } from "../src/db/schema.js";

import {
  asUser,
  createTestApp,
  createTestDatabase,
  createTestUser,
  jsonBody,
} from "./helpers/harness.js";

let db: Database;
let close: () => Promise<void>;
let app: ReturnType<typeof createTestApp>["app"];

const platformAdmin = "platform-admin-user";
const founder = "founder-user";
let organizationId = "";
let workspaceId = "";

async function json(response: Response): Promise<unknown> {
  return response.json();
}

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  ({ app } = createTestApp(db));
  for (const id of [platformAdmin, founder]) await createTestUser(db, id);
  await db.insert(platformAdmins).values({ userId: platformAdmin });

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

describe("GET /api/admin/users", () => {
  it("lists every user for a platform admin", async () => {
    const response = await app.request(
      "/api/admin/users",
      asUser(platformAdmin),
    );
    expect(response.status).toBe(200);
    const users = (await json(response)) as { id: string; email: string }[];
    expect(users.map((entry) => entry.id)).toEqual(
      expect.arrayContaining([platformAdmin, founder]),
    );
  });

  it("returns 403 for an authenticated non-admin", async () => {
    const response = await app.request("/api/admin/users", asUser(founder));
    expect(response.status).toBe(403);
    expect(await json(response)).toMatchObject({
      error: { code: "FORBIDDEN" },
    });
  });

  it("returns 401 for anonymous requests", async () => {
    const response = await app.request("/api/admin/users");
    expect(response.status).toBe(401);
  });
});

describe("GET /api/admin/organizations", () => {
  it("lists organizations the admin is not a member of", async () => {
    const response = await app.request(
      "/api/admin/organizations",
      asUser(platformAdmin),
    );
    expect(response.status).toBe(200);
    const organizations = (await json(response)) as { id: string }[];
    expect(organizations.map((entry) => entry.id)).toContain(organizationId);
  });

  it("returns 403 for an authenticated non-admin", async () => {
    const response = await app.request(
      "/api/admin/organizations",
      asUser(founder),
    );
    expect(response.status).toBe(403);
  });

  it("returns 401 for anonymous requests", async () => {
    const response = await app.request("/api/admin/organizations");
    expect(response.status).toBe(401);
  });
});

describe("GET /api/admin/organizations/:organizationId", () => {
  it("embeds members, sources, workspaces, and work sessions", async () => {
    const response = await app.request(
      `/api/admin/organizations/${organizationId}`,
      asUser(platformAdmin),
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
      `/api/admin/organizations/${organizationId}`,
      asUser(platformAdmin),
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
      "/api/admin/organizations/00000000-0000-4000-8000-000000000999",
      asUser(platformAdmin),
    );
    expect(response.status).toBe(404);
  });

  it("returns 403 for an authenticated non-admin, even a member", async () => {
    const response = await app.request(
      `/api/admin/organizations/${organizationId}`,
      asUser(founder),
    );
    expect(response.status).toBe(403);
  });

  it("returns 401 for anonymous requests", async () => {
    const response = await app.request(
      `/api/admin/organizations/${organizationId}`,
    );
    expect(response.status).toBe(401);
  });
});
