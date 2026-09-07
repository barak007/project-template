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

const owner = "organization-owner";
const member = "organization-member";
const outsider = "organization-outsider";
let organizationId = "";

async function json(response: Response): Promise<unknown> {
  return response.json();
}

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  ({ app } = createTestApp(db));
  for (const id of [owner, member, outsider]) await createTestUser(db, id);

  const created = await app.request(
    "/api/organizations",
    asUser(owner, jsonBody({ name: "Acme" })),
  );
  expect(created.status).toBe(201);
  organizationId = ((await json(created)) as { id: string }).id;
  await joinOrganization(db, organizationId, member, "member");
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
