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

const owner = "source-owner";
const admin = "source-admin";
const member = "source-member";
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
    asUser(owner, jsonBody({ name: "Sources" })),
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

describe("sources", () => {
  let sourceId = "";
  const input = {
    name: "repo",
    kind: "git",
    config: { remote: "https://example.test/repo.git" },
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
