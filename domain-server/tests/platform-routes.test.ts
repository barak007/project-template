import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "../db/client.js";

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
let reported: unknown[];

const owner = "platform-owner";
const outsider = "platform-outsider";
let organizationId = "";

async function json(response: Response): Promise<unknown> {
  return response.json();
}

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  ({ app, reported } = createTestApp(db));
  for (const id of [owner, outsider]) await createTestUser(db, id);

  const created = await app.request(
    "/api/organizations",
    asUser(owner, jsonBody({ name: "Platform" })),
  );
  expect(created.status).toBe(201);
  organizationId = ((await json(created)) as { id: string }).id;
});

afterAll(async () => {
  await close();
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
