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

const owner = "repo-owner";
const member = "repo-member";
const outsider = "repo-outsider";
let organizationId = "";
let otherOrganizationId = "";

async function json(response: Response): Promise<unknown> {
  return response.json();
}

async function createOrganization(userId: string, name: string) {
  const response = await app.request(
    "/api/organizations",
    asUser(userId, jsonBody({ name })),
  );
  expect(response.status).toBe(201);
  return ((await json(response)) as { id: string }).id;
}

function addRepository(
  userId: string,
  targetOrganizationId: string,
  body: Record<string, unknown>,
) {
  return app.request(
    `/api/organizations/${targetOrganizationId}/repositories`,
    asUser(userId, jsonBody(body)),
  );
}

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  ({ app } = createTestApp(db));
  for (const id of [owner, member, outsider]) await createTestUser(db, id);

  organizationId = await createOrganization(owner, "Acme Repositories");
  otherOrganizationId = await createOrganization(outsider, "Elsewhere");
  const membership = await app.request(
    `/api/organizations/${organizationId}/members`,
    asUser(owner, {
      ...jsonBody({ userId: member, role: "member" }),
      method: "PUT",
    }),
  );
  expect(membership.status).toBe(200);
});

afterAll(async () => {
  await close();
});

describe("repositories", () => {
  it("defines a repository from a URL, naming it after the last segment", async () => {
    const response = await addRepository(owner, organizationId, {
      remote: "https://github.com/acme/engine.git",
    });

    expect(response.status).toBe(201);
    expect(await json(response)).toMatchObject({
      name: "engine",
      kind: "git",
      organizationId,
      config: { remote: "https://github.com/acme/engine.git" },
    });
  });

  it("keeps a ref when one is given", async () => {
    const response = await addRepository(owner, organizationId, {
      remote: "ssh://git@github.com/acme/notes.git",
      ref: "develop",
    });

    expect(response.status).toBe(201);
    expect(await json(response)).toMatchObject({
      name: "notes",
      config: { remote: "ssh://git@github.com/acme/notes.git", ref: "develop" },
    });
  });

  it("returns the same repository for a URL already added", async () => {
    const first = await addRepository(owner, organizationId, {
      remote: "git@github.com:acme/billing.git",
    });
    const again = await addRepository(owner, organizationId, {
      remote: "git@github.com:acme/billing.git",
    });

    const firstId = ((await json(first)) as { id: string }).id;
    expect(((await json(again)) as { id: string }).id).toBe(firstId);
  });

  it("suffixes the name when two URLs end the same way", async () => {
    const first = await addRepository(owner, organizationId, {
      remote: "https://github.com/acme/api.git",
    });
    const second = await addRepository(owner, organizationId, {
      remote: "https://gitlab.test/other/api.git",
    });
    const third = await addRepository(owner, organizationId, {
      remote: "https://example.test/third/api.git",
    });

    expect((await json(first)) as { name: string }).toMatchObject({
      name: "api",
    });
    expect((await json(second)) as { name: string }).toMatchObject({
      name: "api-2",
    });
    expect((await json(third)) as { name: string }).toMatchObject({
      name: "api-3",
    });
  });

  it("rejects anything git could not clone", async () => {
    for (const remote of [
      "/Users/ada/projects/engine",
      "file:///Users/ada/projects/engine",
      "ext::sh -c whoami",
      "not a url",
      "",
    ]) {
      const response = await addRepository(owner, organizationId, { remote });
      expect(response.status).toBe(400);
    }
  });

  it("forbids a member, who may read resources but not write them", async () => {
    const response = await addRepository(member, organizationId, {
      remote: "https://github.com/acme/theirs.git",
    });

    expect(response.status).toBe(403);
  });

  it("hides an organization the caller does not belong to", async () => {
    const response = await addRepository(owner, otherOrganizationId, {
      remote: "https://github.com/acme/elsewhere.git",
    });

    expect(response.status).toBe(403);
  });
});
