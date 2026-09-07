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

const owner = "membership-owner";
const admin = "membership-admin";
const member = "membership-member";
const outsider = "membership-outsider";
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
    asUser(owner, jsonBody({ name: "Memberships" })),
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

describe("memberships", () => {
  it("lets any member read the roster and outsiders read nothing", async () => {
    // Who else can see this is not an administrator's secret: membership is the
    // only access control there is.
    const listed = await app.request(
      `/api/organizations/${organizationId}/members`,
      asUser(member),
    );
    expect(listed.status).toBe(200);
    expect(await json(listed)).toHaveLength(3);

    const denied = await app.request(
      `/api/organizations/${organizationId}/members`,
      asUser(outsider),
    );
    expect(denied.status).toBe(403);
  });

  it("restricts changing a role to owners", async () => {
    const denied = await app.request(
      `/api/organizations/${organizationId}/members`,
      asUser(admin, {
        ...jsonBody({ userId: member, role: "admin" }),
        method: "PUT",
      }),
    );
    expect(denied.status).toBe(403);
  });

  it("cannot add a member: joining is an invitation, accepted", async () => {
    const response = await app.request(
      `/api/organizations/${organizationId}/members`,
      asUser(owner, {
        ...jsonBody({ userId: outsider, role: "member" }),
        method: "PUT",
      }),
    );
    expect(response.status).toBe(404);
    expect(await json(response)).toMatchObject({
      error: { code: "NOT_FOUND" },
    });
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

  it("reports an unknown user as a missing membership", async () => {
    const response = await app.request(
      `/api/organizations/${organizationId}/members`,
      asUser(owner, {
        ...jsonBody({ userId: "no-such-user", role: "member" }),
        method: "PUT",
      }),
    );
    expect(response.status).toBe(404);
  });
});
