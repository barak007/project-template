import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "../db/client.js";

import {
  asUser,
  createTestApp,
  createTestDatabase,
  createTestUser,
  joinOrganization,
  jsonBody,
} from "./helpers/harness.js";

let db: Database;
let close: () => Promise<void>;
let app: ReturnType<typeof createTestApp>["app"];

const owner = "workspace-owner";
const admin = "workspace-admin";
const member = "workspace-member";
let organizationId = "";

async function json(response: Response): Promise<unknown> {
  return response.json();
}

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  ({ app } = createTestApp(db));
  for (const id of [owner, admin, member]) await createTestUser(db, id);

  const created = await app.request(
    "/api/organizations",
    asUser(owner, jsonBody({ name: "Acme" })),
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
    expect(await json(listed)).toMatchObject([
      { id: workspaceId, name: "main", sourceIds: [sourceId] },
      { name: "Acme", sourceIds: [] },
    ]);

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
