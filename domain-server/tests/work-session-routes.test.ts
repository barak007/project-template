import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "../db/client.js";
import { workSessions } from "../db/schema.js";

import {
  asUser,
  createTestApp,
  createTestDatabase,
  createTestUser,
  joinOrganization,
  jsonBody,
  testCipher,
} from "./helpers/harness.js";

let db: Database;
let close: () => Promise<void>;
let app: ReturnType<typeof createTestApp>["app"];
let enqueued: string[];

const owner = "session-owner";
const admin = "session-admin";
const member = "session-member";
let organizationId = "";

async function json(response: Response): Promise<unknown> {
  return response.json();
}

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  ({ app, enqueued } = createTestApp(db));
  for (const id of [owner, admin, member]) await createTestUser(db, id);

  const created = await app.request(
    "/api/organizations",
    asUser(owner, jsonBody({ name: "Sessions" })),
  );
  expect(created.status).toBe(201);
  organizationId = ((await json(created)) as { id: string }).id;
  for (const [userId, role] of [
    [admin, "admin"],
    [member, "member"],
  ] as const)
    await joinOrganization(db, organizationId, userId, role);
});

afterAll(async () => {
  await close();
});

describe("work sessions", () => {
  let workspaceId = "";
  let workSessionId = "";

  beforeAll(async () => {
    const source = await app.request(
      `/api/organizations/${organizationId}/sources`,
      asUser(
        admin,
        jsonBody({
          name: "sessions-repo",
          kind: "git",
          config: { remote: "https://example.test/repo.git" },
        }),
      ),
    );
    const sourceId = ((await json(source)) as { id: string }).id;
    const workspace = await app.request(
      `/api/organizations/${organizationId}/workspaces`,
      asUser(admin, jsonBody({ name: "sessions", sourceIds: [sourceId] })),
    );
    workspaceId = ((await json(workspace)) as { id: string }).id;

    await app.request(
      `/api/organizations/${organizationId}/data`,
      asUser(admin, {
        ...jsonBody({ key: "theme", value: "dark" }),
        method: "PUT",
      }),
    );
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
