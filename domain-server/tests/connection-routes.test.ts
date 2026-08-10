import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

const owner = "connections-owner";
const member = "connections-member";
const outsider = "connections-outsider";
let organizationId = "";
let otherOrganizationId = "";
let root = "";

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

/** A real folder: the local provider reads the filesystem, so the test does too. */
beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  ({ app } = createTestApp(db));
  for (const id of [owner, member, outsider]) await createTestUser(db, id);

  root = await mkdtemp(join(tmpdir(), "wwsa-connection-routes-"));
  await mkdir(join(root, "engine", ".git"), { recursive: true });
  await mkdir(join(root, "not-a-repository"), { recursive: true });

  organizationId = await createOrganization(owner, "Acme");
  otherOrganizationId = await createOrganization(outsider, "Other");
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
  await rm(root, { recursive: true, force: true });
  await close();
});

function connect(userId: string, rootPath: string, id = organizationId) {
  return app.request(
    `/api/organizations/${id}/connections`,
    asUser(userId, {
      ...jsonBody({ provider: "local", config: { rootPath } }),
      method: "PUT",
    }),
  );
}

describe("connections", () => {
  it("connects a folder and lists it", async () => {
    const connected = await connect(owner, root);
    expect(connected.status).toBe(200);
    expect(await json(connected)).toMatchObject({
      provider: "local",
      label: root,
    });

    const listed = await app.request(
      `/api/organizations/${organizationId}/connections`,
      asUser(member),
    );
    expect(listed.status).toBe(200);
    expect((await json(listed)) as unknown[]).toHaveLength(1);
  });

  it("replaces the connection rather than adding a second one", async () => {
    const again = await connect(owner, root);
    expect(again.status).toBe(200);

    const listed = await app.request(
      `/api/organizations/${organizationId}/connections`,
      asUser(owner),
    );
    expect((await json(listed)) as unknown[]).toHaveLength(1);
  });

  it("refuses a member: connecting is connection:manage", async () => {
    const response = await connect(member, root);
    expect(response.status).toBe(403);
  });

  it("refuses a folder that does not exist", async () => {
    const response = await connect(owner, join(root, "missing"));
    expect(response.status).toBe(400);
  });

  it("refuses a provider this deployment cannot use", async () => {
    const response = await app.request(
      `/api/organizations/${organizationId}/connections`,
      asUser(owner, {
        ...jsonBody({ provider: "github", config: {} }),
        method: "PUT",
      }),
    );
    expect(response.status).toBe(400);
  });

  it("hides another organization's connections", async () => {
    const response = await app.request(
      `/api/organizations/${otherOrganizationId}/connections`,
      asUser(owner),
    );
    expect(response.status).toBe(403);
  });

  it("does not delete a connection through another organization", async () => {
    const listed = await app.request(
      `/api/organizations/${organizationId}/connections`,
      asUser(owner),
    );
    const [connection] = (await json(listed)) as { id: string }[];
    const response = await app.request(
      `/api/organizations/${otherOrganizationId}/connections/${connection?.id}`,
      asUser(outsider, { method: "DELETE" }),
    );
    expect(response.status).toBe(404);
  });
});

describe("repositories", () => {
  it("lists only the directories that are repositories", async () => {
    const response = await app.request(
      `/api/organizations/${organizationId}/repositories`,
      asUser(member),
    );
    expect(response.status).toBe(200);
    const repositories = (await json(response)) as { name: string }[];
    expect(repositories.map((one) => one.name)).toEqual(["engine"]);
  });

  it("imports a repository as a git source, once", async () => {
    const listed = await app.request(
      `/api/organizations/${organizationId}/repositories`,
      asUser(owner),
    );
    const [repository] = (await json(listed)) as {
      connectionId: string;
      externalId: string;
    }[];
    if (!repository) throw new Error("the folder exposed no repositories");

    const first = await app.request(
      `/api/organizations/${organizationId}/repositories`,
      asUser(owner, jsonBody(repository)),
    );
    expect(first.status).toBe(201);
    const source = (await json(first)) as { id: string; kind: string };
    expect(source.kind).toBe("git");

    const second = await app.request(
      `/api/organizations/${organizationId}/repositories`,
      asUser(owner, jsonBody(repository)),
    );
    expect(((await json(second)) as { id: string }).id).toBe(source.id);

    const sources = await app.request(
      `/api/organizations/${organizationId}/sources`,
      asUser(owner),
    );
    expect((await json(sources)) as unknown[]).toHaveLength(1);
  });

  it("refuses a member: importing is resource:write", async () => {
    const listed = await app.request(
      `/api/organizations/${organizationId}/repositories`,
      asUser(member),
    );
    const [repository] = (await json(listed)) as unknown[];
    const response = await app.request(
      `/api/organizations/${organizationId}/repositories`,
      asUser(member, jsonBody(repository)),
    );
    expect(response.status).toBe(403);
  });

  it("does not import through another organization's connection", async () => {
    const listed = await app.request(
      `/api/organizations/${organizationId}/repositories`,
      asUser(owner),
    );
    const [repository] = (await json(listed)) as unknown[];
    const response = await app.request(
      `/api/organizations/${otherOrganizationId}/repositories`,
      asUser(outsider, jsonBody(repository)),
    );
    expect(response.status).toBe(404);
  });
});
