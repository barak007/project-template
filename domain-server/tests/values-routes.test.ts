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

const owner = "values-owner";
const admin = "values-admin";
const member = "values-member";
const outsider = "values-outsider";
let organizationId = "";

async function json(response: Response): Promise<unknown> {
  return response.json();
}

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  ({ app } = createTestApp(db));
  for (const id of [owner, admin, member, outsider])
    await createTestUser(db, id);

  const created = await app.request(
    "/api/organizations",
    asUser(owner, jsonBody({ name: "Values" })),
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
