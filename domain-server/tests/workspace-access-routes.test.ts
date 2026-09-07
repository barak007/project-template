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

const owner = "access-owner";
const member = "access-member";
const grantedManager = "access-granted-manager";
const outsider = "access-outsider";
let organizationId = "";
let workspaceId = "";
let otherOrganizationWorkspaceId = "";

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

async function createWorkspace(
  userId: string,
  targetOrganizationId: string,
  name: string,
) {
  const response = await app.request(
    `/api/organizations/${targetOrganizationId}/workspaces`,
    asUser(userId, jsonBody({ name })),
  );
  expect(response.status).toBe(201);
  return ((await json(response)) as { id: string }).id;
}

function listGrants(userId: string, targetWorkspaceId: string) {
  return app.request(
    `/api/organizations/${organizationId}/workspaces/${targetWorkspaceId}/grants`,
    asUser(userId),
  );
}

function putGrant(
  userId: string,
  targetWorkspaceId: string,
  body: Record<string, unknown>,
) {
  return app.request(
    `/api/organizations/${organizationId}/workspaces/${targetWorkspaceId}/grants`,
    asUser(userId, { ...jsonBody(body), method: "PUT" }),
  );
}

function removeGrant(
  userId: string,
  targetWorkspaceId: string,
  subjectUserId: string,
) {
  return app.request(
    `/api/organizations/${organizationId}/workspaces/${targetWorkspaceId}/grants/${subjectUserId}`,
    asUser(userId, { method: "DELETE" }),
  );
}

function putVisibility(
  userId: string,
  targetWorkspaceId: string,
  visibility: string,
) {
  return app.request(
    `/api/organizations/${organizationId}/workspaces/${targetWorkspaceId}/visibility`,
    asUser(userId, { ...jsonBody({ visibility }), method: "PUT" }),
  );
}

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  ({ app } = createTestApp(db));
  for (const id of [owner, member, grantedManager, outsider])
    await createTestUser(db, id);

  organizationId = await createOrganization(owner, "Acme Access");
  const otherOrganizationId = await createOrganization(outsider, "Elsewhere");
  await joinOrganization(db, organizationId, member, "member");
  await joinOrganization(db, organizationId, grantedManager, "member");

  workspaceId = await createWorkspace(owner, organizationId, "Shared Docs");
  otherOrganizationWorkspaceId = await createWorkspace(
    outsider,
    otherOrganizationId,
    "Their Workspace",
  );

  const granted = await putGrant(owner, workspaceId, {
    userId: grantedManager,
    role: "manager",
  });
  expect(granted.status).toBe(200);
});

afterAll(async () => {
  await close();
});

describe("listing grants", () => {
  it("names each granted person for the workspace's manager", async () => {
    const response = await listGrants(owner, workspaceId);

    expect(response.status).toBe(200);
    // Creating a workspace granted its creator manager, so two rows.
    expect(await json(response)).toMatchObject([
      {
        workspaceId,
        userId: owner,
        role: "manager",
        name: `User ${owner}`,
        email: `${owner}@example.test`,
      },
      {
        workspaceId,
        userId: grantedManager,
        role: "manager",
        name: `User ${grantedManager}`,
        email: `${grantedManager}@example.test`,
      },
    ]);
  });

  it("lets a member manage through a manager grant, not just owners", async () => {
    const response = await listGrants(grantedManager, workspaceId);

    expect(response.status).toBe(200);
  });

  it("forbids a plain member, who can see the workspace but not run it", async () => {
    const response = await listGrants(member, workspaceId);

    expect(response.status).toBe(403);
  });

  it("hides a workspace belonging to another organization", async () => {
    const response = await listGrants(
      grantedManager,
      otherOrganizationWorkspaceId,
    );

    expect(response.status).toBe(404);
  });

  it("hides it from an organization owner too", async () => {
    // Regression: the owner/admin shortcut used to skip the
    // workspace-in-organization check, leaking another tenant's grant list.
    const response = await listGrants(owner, otherOrganizationWorkspaceId);

    expect(response.status).toBe(404);
  });
});

describe("granting access", () => {
  it("grants a member a role on the workspace", async () => {
    const response = await putGrant(owner, workspaceId, {
      userId: member,
      role: "editor",
    });

    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({
      workspaceId,
      userId: member,
      role: "editor",
      name: `User ${member}`,
      email: `${member}@example.test`,
    });
  });

  it("changes the role when the person already holds a grant", async () => {
    const response = await putGrant(owner, workspaceId, {
      userId: member,
      role: "operator",
    });

    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({
      userId: member,
      role: "operator",
    });
  });

  it("refuses a grant to somebody outside the organization", async () => {
    const response = await putGrant(owner, workspaceId, {
      userId: outsider,
      role: "viewer",
    });

    expect(response.status).toBe(400);
  });

  it("forbids a member without workspace:manage", async () => {
    const response = await putGrant(member, workspaceId, {
      userId: member,
      role: "manager",
    });

    expect(response.status).toBe(403);
  });

  it("hides a workspace belonging to another organization", async () => {
    const response = await putGrant(
      grantedManager,
      otherOrganizationWorkspaceId,
      { userId: member, role: "viewer" },
    );

    expect(response.status).toBe(404);
  });

  it("hides it from an organization owner too", async () => {
    const response = await putGrant(owner, otherOrganizationWorkspaceId, {
      userId: member,
      role: "viewer",
    });

    expect(response.status).toBe(404);
  });
});

describe("removing a grant", () => {
  it("forbids a member without workspace:manage", async () => {
    const response = await removeGrant(member, workspaceId, member);

    expect(response.status).toBe(403);
  });

  it("hides a workspace belonging to another organization", async () => {
    const response = await removeGrant(
      grantedManager,
      otherOrganizationWorkspaceId,
      member,
    );

    expect(response.status).toBe(404);
  });

  it("hides it from an organization owner too", async () => {
    const response = await removeGrant(
      owner,
      otherOrganizationWorkspaceId,
      outsider,
    );

    expect(response.status).toBe(404);
  });

  it("removes the grant and leaves the rest", async () => {
    const response = await removeGrant(owner, workspaceId, member);

    expect(response.status).toBe(204);
    const remaining = await listGrants(owner, workspaceId);
    expect(
      ((await json(remaining)) as { userId: string }[]).map(
        (grant) => grant.userId,
      ),
    ).toEqual([owner, grantedManager]);
  });

  it("answers 404 when no grant exists for that person", async () => {
    const response = await removeGrant(owner, workspaceId, member);

    expect(response.status).toBe(404);
  });
});

describe("changing visibility", () => {
  it("forbids a member without workspace:manage", async () => {
    const response = await putVisibility(member, workspaceId, "restricted");

    expect(response.status).toBe(403);
  });

  it("hides a workspace belonging to another organization", async () => {
    const response = await putVisibility(
      owner,
      otherOrganizationWorkspaceId,
      "restricted",
    );

    expect(response.status).toBe(404);
  });

  it("restricts the workspace and returns it whole", async () => {
    const response = await putVisibility(owner, workspaceId, "restricted");

    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({
      id: workspaceId,
      organizationId,
      visibility: "restricted",
      sourceIds: [],
      yourRole: "manager",
    });
  });

  it("makes the workspace vanish for an ungranted member once restricted", async () => {
    // 404, not 403: a restricted workspace must not confirm it exists.
    const response = await listGrants(member, workspaceId);

    expect(response.status).toBe(404);
  });

  it("opens the workspace back up to every member", async () => {
    const reopened = await putVisibility(owner, workspaceId, "organization");
    expect(reopened.status).toBe(200);

    // Visible again, though still only readable: managing stays forbidden.
    const response = await listGrants(member, workspaceId);
    expect(response.status).toBe(403);
  });
});
