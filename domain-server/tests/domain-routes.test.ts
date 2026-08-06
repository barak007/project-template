import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "../db/client.js";
import { workSessions } from "../db/schema.js";

import {
  asUser,
  createTestApp,
  createTestDatabase,
  createTestUser,
  jsonBody,
  testCipher,
} from "./helpers/harness.js";

let db: Database;
let close: () => Promise<void>;
let app: ReturnType<typeof createTestApp>["app"];
let enqueued: string[];
let reported: unknown[];

const owner = "owner-user";
const admin = "admin-user";
const member = "member-user";
const outsider = "outsider-user";
let organizationId = "";

async function json(response: Response): Promise<unknown> {
  return response.json();
}

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  ({ app, enqueued, reported } = createTestApp(db));
  for (const id of [owner, admin, member, outsider])
    await createTestUser(db, id);

  const created = await app.request(
    "/api/organizations",
    asUser(owner, jsonBody({ name: "Acme" })),
  );
  expect(created.status).toBe(201);
  organizationId = ((await json(created)) as { id: string }).id;
  for (const [userId, role] of [
    [admin, "admin"],
    [member, "member"],
  ] as const) {
    const response = await app.request(
      `/api/organizations/${organizationId}/members`,
      asUser(owner, { ...jsonBody({ userId, role }), method: "PUT" }),
    );
    expect(response.status).toBe(200);
  }
});

afterAll(async () => {
  await close();
});

describe("organizations", () => {
  it("lists only organizations the user belongs to", async () => {
    const mine = await app.request("/api/organizations", asUser(owner));
    expect(await json(mine)).toHaveLength(1);
    const theirs = await app.request("/api/organizations", asUser(outsider));
    expect(await json(theirs)).toHaveLength(0);
  });

  it("returns an organization to members and 403 to outsiders", async () => {
    const ok = await app.request(
      `/api/organizations/${organizationId}`,
      asUser(member),
    );
    expect(ok.status).toBe(200);
    expect(await json(ok)).toMatchObject({ id: organizationId, name: "Acme" });

    const forbidden = await app.request(
      `/api/organizations/${organizationId}`,
      asUser(outsider),
    );
    expect(forbidden.status).toBe(403);
    expect(await json(forbidden)).toMatchObject({
      error: { code: "FORBIDDEN" },
    });
  });

  it("rejects malformed ids with a validation error", async () => {
    const response = await app.request(
      "/api/organizations/not-a-uuid",
      asUser(owner),
    );
    expect(response.status).toBe(400);
    expect(await json(response)).toMatchObject({
      error: { code: "VALIDATION_FAILED" },
    });
  });

  it("rejects organization names that are empty after trimming", async () => {
    const response = await app.request(
      "/api/organizations",
      asUser(owner, jsonBody({ name: "   " })),
    );
    expect(response.status).toBe(400);
  });
});

describe("memberships", () => {
  it("restricts membership management to owners", async () => {
    const denied = await app.request(
      `/api/organizations/${organizationId}/members`,
      asUser(admin),
    );
    expect(denied.status).toBe(403);

    const listed = await app.request(
      `/api/organizations/${organizationId}/members`,
      asUser(owner),
    );
    expect(listed.status).toBe(200);
    expect(await json(listed)).toHaveLength(3);
  });

  it("updates an existing membership in place", async () => {
    const response = await app.request(
      `/api/organizations/${organizationId}/members`,
      asUser(owner, {
        ...jsonBody({ userId: member, role: "member" }),
        method: "PUT",
      }),
    );
    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({
      userId: member,
      role: "member",
    });
  });

  it("rejects unknown roles", async () => {
    const response = await app.request(
      `/api/organizations/${organizationId}/members`,
      asUser(owner, {
        ...jsonBody({ userId: member, role: "superuser" }),
        method: "PUT",
      }),
    );
    expect(response.status).toBe(400);
  });

  it("maps foreign-key violations to a conflict", async () => {
    const response = await app.request(
      `/api/organizations/${organizationId}/members`,
      asUser(owner, {
        ...jsonBody({ userId: "no-such-user", role: "member" }),
        method: "PUT",
      }),
    );
    expect(response.status).toBe(409);
    expect(await json(response)).toMatchObject({ error: { code: "CONFLICT" } });
  });
});

describe("sources", () => {
  let sourceId = "";
  const input = {
    name: "repo",
    kind: "git",
    config: { url: "https://example.test/repo.git" },
  };

  it("allows writers to create and readers to list", async () => {
    const denied = await app.request(
      `/api/organizations/${organizationId}/sources`,
      asUser(member, jsonBody(input)),
    );
    expect(denied.status).toBe(403);

    const created = await app.request(
      `/api/organizations/${organizationId}/sources`,
      asUser(admin, jsonBody(input)),
    );
    expect(created.status).toBe(201);
    sourceId = ((await json(created)) as { id: string }).id;

    const listed = await app.request(
      `/api/organizations/${organizationId}/sources`,
      asUser(member),
    );
    expect(listed.status).toBe(200);
    expect(await json(listed)).toHaveLength(1);
  });

  it("rejects duplicate source names within an organization", async () => {
    const response = await app.request(
      `/api/organizations/${organizationId}/sources`,
      asUser(admin, jsonBody(input)),
    );
    expect(response.status).toBe(409);
  });

  it("updates a source and 404s on unknown ids", async () => {
    const updated = await app.request(
      `/api/organizations/${organizationId}/sources/${sourceId}`,
      asUser(admin, {
        ...jsonBody({ ...input, name: "renamed" }),
        method: "PUT",
      }),
    );
    expect(updated.status).toBe(200);
    expect(await json(updated)).toMatchObject({ name: "renamed" });

    const missing = await app.request(
      `/api/organizations/${organizationId}/sources/${organizationId}`,
      asUser(admin, { ...jsonBody(input), method: "PUT" }),
    );
    expect(missing.status).toBe(404);
  });

  it("deletes a source exactly once", async () => {
    const deleted = await app.request(
      `/api/organizations/${organizationId}/sources/${sourceId}`,
      asUser(admin, { method: "DELETE" }),
    );
    expect(deleted.status).toBe(204);

    const again = await app.request(
      `/api/organizations/${organizationId}/sources/${sourceId}`,
      asUser(admin, { method: "DELETE" }),
    );
    expect(again.status).toBe(404);
  });
});

describe("workspaces", () => {
  let sourceId = "";
  let workspaceId = "";

  beforeAll(async () => {
    const created = await app.request(
      `/api/organizations/${organizationId}/sources`,
      asUser(admin, jsonBody({ name: "db", kind: "database", config: {} })),
    );
    sourceId = ((await json(created)) as { id: string }).id;
  });

  it("rejects sources that do not belong to the organization", async () => {
    const response = await app.request(
      `/api/organizations/${organizationId}/workspaces`,
      asUser(admin, jsonBody({ name: "main", sourceIds: [organizationId] })),
    );
    expect(response.status).toBe(400);
  });

  it("rejects duplicate source ids in the input", async () => {
    const response = await app.request(
      `/api/organizations/${organizationId}/workspaces`,
      asUser(
        admin,
        jsonBody({ name: "main", sourceIds: [sourceId, sourceId] }),
      ),
    );
    expect(response.status).toBe(400);
  });

  it("creates, lists, updates, and deletes workspaces", async () => {
    const created = await app.request(
      `/api/organizations/${organizationId}/workspaces`,
      asUser(admin, jsonBody({ name: "main", sourceIds: [sourceId] })),
    );
    expect(created.status).toBe(201);
    const workspace = (await json(created)) as {
      id: string;
      sourceIds: string[];
    };
    workspaceId = workspace.id;
    expect(workspace.sourceIds).toEqual([sourceId]);

    const listed = await app.request(
      `/api/organizations/${organizationId}/workspaces`,
      asUser(member),
    );
    expect(listed.status).toBe(200);
    expect(await json(listed)).toMatchObject([{ sourceIds: [sourceId] }]);

    const relinked = await app.request(
      `/api/organizations/${organizationId}/workspaces/${workspaceId}`,
      asUser(admin, {
        ...jsonBody({ name: "relinked", sourceIds: [sourceId] }),
        method: "PUT",
      }),
    );
    expect(relinked.status).toBe(200);
    expect(await json(relinked)).toMatchObject({ sourceIds: [sourceId] });

    const updated = await app.request(
      `/api/organizations/${organizationId}/workspaces/${workspaceId}`,
      asUser(admin, {
        ...jsonBody({ name: "renamed", sourceIds: [] }),
        method: "PUT",
      }),
    );
    expect(updated.status).toBe(200);
    expect(await json(updated)).toMatchObject({
      name: "renamed",
      sourceIds: [],
    });

    const missing = await app.request(
      `/api/organizations/${organizationId}/workspaces/${organizationId}`,
      asUser(admin, {
        ...jsonBody({ name: "x", sourceIds: [] }),
        method: "PUT",
      }),
    );
    expect(missing.status).toBe(404);

    const deleted = await app.request(
      `/api/organizations/${organizationId}/workspaces/${workspaceId}`,
      asUser(admin, { method: "DELETE" }),
    );
    expect(deleted.status).toBe(204);
    const again = await app.request(
      `/api/organizations/${organizationId}/workspaces/${workspaceId}`,
      asUser(admin, { method: "DELETE" }),
    );
    expect(again.status).toBe(404);
  });
});

describe("organization secrets and data", () => {
  it("manages secrets without ever returning values", async () => {
    const denied = await app.request(
      `/api/organizations/${organizationId}/secrets`,
      asUser(member, {
        ...jsonBody({ key: "TOKEN", value: "s3cr3t" }),
        method: "PUT",
      }),
    );
    expect(denied.status).toBe(403);

    const put = await app.request(
      `/api/organizations/${organizationId}/secrets`,
      asUser(admin, {
        ...jsonBody({ key: "TOKEN", value: "s3cr3t" }),
        method: "PUT",
      }),
    );
    expect(put.status).toBe(200);
    const stored = (await json(put)) as Record<string, unknown>;
    expect(stored).toMatchObject({ key: "TOKEN" });
    expect(JSON.stringify(stored)).not.toContain("s3cr3t");

    const updated = await app.request(
      `/api/organizations/${organizationId}/secrets`,
      asUser(admin, {
        ...jsonBody({ key: "TOKEN", value: "rotated" }),
        method: "PUT",
      }),
    );
    expect(updated.status).toBe(200);

    const listed = await app.request(
      `/api/organizations/${organizationId}/secrets`,
      asUser(owner),
    );
    expect(listed.status).toBe(200);
    const body = JSON.stringify(await json(listed));
    expect(body).toContain("TOKEN");
    expect(body).not.toContain("rotated");
  });

  it("rejects keys with unsafe characters", async () => {
    const response = await app.request(
      `/api/organizations/${organizationId}/secrets`,
      asUser(admin, {
        ...jsonBody({ key: "bad key!", value: "x" }),
        method: "PUT",
      }),
    );
    expect(response.status).toBe(400);
  });

  it("deletes secrets exactly once", async () => {
    const deleted = await app.request(
      `/api/organizations/${organizationId}/secrets/TOKEN`,
      asUser(admin, { method: "DELETE" }),
    );
    expect(deleted.status).toBe(204);
    const again = await app.request(
      `/api/organizations/${organizationId}/secrets/TOKEN`,
      asUser(admin, { method: "DELETE" }),
    );
    expect(again.status).toBe(404);
  });

  it("upserts organization data readable by members", async () => {
    const denied = await app.request(
      `/api/organizations/${organizationId}/data`,
      asUser(member, {
        ...jsonBody({ key: "theme", value: "light" }),
        method: "PUT",
      }),
    );
    expect(denied.status).toBe(403);

    await app.request(
      `/api/organizations/${organizationId}/data`,
      asUser(admin, {
        ...jsonBody({ key: "theme", value: "light" }),
        method: "PUT",
      }),
    );
    const updated = await app.request(
      `/api/organizations/${organizationId}/data`,
      asUser(admin, {
        ...jsonBody({ key: "theme", value: "dark" }),
        method: "PUT",
      }),
    );
    expect(updated.status).toBe(200);
    expect(await json(updated)).toMatchObject({ key: "theme", value: "dark" });

    const listed = await app.request(
      `/api/organizations/${organizationId}/data`,
      asUser(member),
    );
    expect(listed.status).toBe(200);
    expect(await json(listed)).toMatchObject([{ key: "theme", value: "dark" }]);
  });
});

describe("personal secrets and data", () => {
  it("scopes secrets to the requesting user", async () => {
    const put = await app.request(
      "/api/me/secrets",
      asUser(member, {
        ...jsonBody({ key: "PAT", value: "mine" }),
        method: "PUT",
      }),
    );
    expect(put.status).toBe(200);

    const mine = await app.request("/api/me/secrets", asUser(member));
    expect(await json(mine)).toHaveLength(1);
    const theirs = await app.request("/api/me/secrets", asUser(outsider));
    expect(await json(theirs)).toHaveLength(0);

    const deleted = await app.request("/api/me/secrets/PAT", {
      ...asUser(member),
      method: "DELETE",
    });
    expect(deleted.status).toBe(204);
    const again = await app.request("/api/me/secrets/PAT", {
      ...asUser(member),
      method: "DELETE",
    });
    expect(again.status).toBe(404);
  });

  it("scopes data to the requesting user", async () => {
    const put = await app.request(
      "/api/me/data",
      asUser(member, {
        ...jsonBody({ key: "editor", value: "vim" }),
        method: "PUT",
      }),
    );
    expect(put.status).toBe(200);
    const upserted = await app.request(
      "/api/me/data",
      asUser(member, {
        ...jsonBody({ key: "editor", value: "emacs" }),
        method: "PUT",
      }),
    );
    expect(await json(upserted)).toMatchObject({ value: "emacs" });

    const mine = await app.request("/api/me/data", asUser(member));
    expect(await json(mine)).toMatchObject([{ key: "editor", value: "emacs" }]);
    const theirs = await app.request("/api/me/data", asUser(outsider));
    expect(await json(theirs)).toHaveLength(0);
  });
});

describe("work sessions", () => {
  let workspaceId = "";
  let workSessionId = "";

  beforeAll(async () => {
    const source = await app.request(
      `/api/organizations/${organizationId}/sources`,
      asUser(
        admin,
        jsonBody({ name: "sessions-repo", kind: "git", config: {} }),
      ),
    );
    const sourceId = ((await json(source)) as { id: string }).id;
    const workspace = await app.request(
      `/api/organizations/${organizationId}/workspaces`,
      asUser(admin, jsonBody({ name: "sessions", sourceIds: [sourceId] })),
    );
    workspaceId = ((await json(workspace)) as { id: string }).id;

    for (const [path, value] of [
      [`/api/organizations/${organizationId}/secrets`, "org-secret"],
      ["/api/me/secrets", "user-secret"],
    ] as const)
      await app.request(
        path,
        asUser(admin, { ...jsonBody({ key: "SHARED", value }), method: "PUT" }),
      );
    for (const [path, value] of [
      [`/api/organizations/${organizationId}/data`, "org-value"],
      ["/api/me/data", "user-value"],
    ] as const)
      await app.request(
        path,
        asUser(admin, { ...jsonBody({ key: "shared", value }), method: "PUT" }),
      );
  });

  it("creates a pending session with an encrypted, user-precedence snapshot", async () => {
    const response = await app.request(
      `/api/organizations/${organizationId}/work-sessions`,
      asUser(admin, jsonBody({ workspaceId })),
    );
    expect(response.status).toBe(202);
    const session = (await json(response)) as {
      id: string;
      status: string;
      secretKeys: string[];
      dataSnapshot: Record<string, unknown>;
      sourcesSnapshot: unknown[];
    };
    workSessionId = session.id;
    expect(session.status).toBe("pending");
    expect(session.secretKeys).toEqual(["SHARED"]);
    expect(session.dataSnapshot).toEqual({
      shared: "user-value",
      theme: "dark",
    });
    expect(session.sourcesSnapshot).toHaveLength(1);
    expect(enqueued).toContain(session.id);
    expect(JSON.stringify(session)).not.toContain("user-secret");

    const [persisted] = await db
      .select()
      .from(workSessions)
      .where(eq(workSessions.id, session.id));
    if (!persisted) throw new Error("Session row missing");
    expect(persisted.secretsSnapshot.SHARED).not.toContain("user-secret");
    expect(testCipher.decrypt(persisted.secretsSnapshot.SHARED ?? "")).toBe(
      "user-secret",
    );
  });

  it("lists and fetches sessions without exposing secret values", async () => {
    const listed = await app.request(
      `/api/organizations/${organizationId}/work-sessions`,
      asUser(member),
    );
    expect(listed.status).toBe(200);
    expect(await json(listed)).toHaveLength(1);

    const fetched = await app.request(
      `/api/organizations/${organizationId}/work-sessions/${workSessionId}`,
      asUser(member),
    );
    expect(fetched.status).toBe(200);
    expect(JSON.stringify(await json(fetched))).not.toContain("user-secret");

    const missing = await app.request(
      `/api/organizations/${organizationId}/work-sessions/${organizationId}`,
      asUser(member),
    );
    expect(missing.status).toBe(404);
  });

  it("404s when the workspace does not belong to the organization", async () => {
    const response = await app.request(
      `/api/organizations/${organizationId}/work-sessions`,
      asUser(admin, jsonBody({ workspaceId: organizationId })),
    );
    expect(response.status).toBe(404);
  });

  it("refuses to delete a workspace with existing sessions", async () => {
    const response = await app.request(
      `/api/organizations/${organizationId}/workspaces/${workspaceId}`,
      asUser(admin, { method: "DELETE" }),
    );
    expect(response.status).toBe(409);
    expect(await json(response)).toMatchObject({
      error: { code: "CONFLICT", message: "The record is still in use" },
    });
  });

  it("marks the session failed and reports when enqueueing fails", async () => {
    const failing = createTestApp(db, {
      jobs: {
        enqueueMaterialize: () => Promise.reject(new Error("queue down")),
      },
    });
    const response = await failing.app.request(
      `/api/organizations/${organizationId}/work-sessions`,
      asUser(admin, jsonBody({ workspaceId })),
    );
    expect(response.status).toBe(500);
    expect(await json(response)).toMatchObject({
      error: { code: "INTERNAL_ERROR" },
    });
    expect(failing.reported).toHaveLength(1);

    const failed = await db
      .select()
      .from(workSessions)
      .where(eq(workSessions.status, "failed"));
    expect(failed).toHaveLength(1);
    expect(failed[0]?.failureCode).toBe("QUEUE_UNAVAILABLE");
  });
});

describe("platform routes", () => {
  it("forwards /api/auth traffic to the auth handler", async () => {
    const response = await app.request("/api/auth/sign-in");
    expect(await response.text()).toBe("auth-handler");
  });

  it("does not report expected client errors", async () => {
    await app.request(`/api/organizations/${organizationId}`, asUser(outsider));
    expect(reported).toHaveLength(0);
  });
});
