import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "../db/client.js";
import { workSessions } from "../db/schema.js";

import {
  asUser,
  createTestApp,
  createTestDatabase,
  createTestUser,
  jsonBody,
} from "./helpers/harness.js";
import { recordingProjectBuilder } from "./helpers/project-builder.js";

let db: Database;
let close: () => Promise<void>;
let app: ReturnType<typeof createTestApp>["app"];
let branched: { branch: string }[];

const owner = "project-owner";
const member = "project-member";
const outsider = "project-outsider";
let organizationId = "";
let otherOrganizationId = "";
let workSessionId = "";

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

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  const recording = recordingProjectBuilder();
  branched = recording.branched;
  ({ app } = createTestApp(db, {
    projectBuilder: recording.projectBuilder,
  }));
  for (const id of [owner, member, outsider]) await createTestUser(db, id);

  organizationId = await createOrganization(owner, "Acme Projects");
  otherOrganizationId = await createOrganization(outsider, "Elsewhere");
  const membership = await app.request(
    `/api/organizations/${organizationId}/members`,
    asUser(owner, {
      ...jsonBody({ userId: member, role: "member" }),
      method: "PUT",
    }),
  );
  expect(membership.status).toBe(200);

  const workspace = await app.request(
    `/api/organizations/${organizationId}/workspaces`,
    asUser(owner, jsonBody({ name: "Platform" })),
  );
  expect(workspace.status).toBe(201);
  const workspaceId = ((await json(workspace)) as { id: string }).id;
  const session = await app.request(
    `/api/organizations/${organizationId}/work-sessions`,
    asUser(owner, jsonBody({ workspaceId })),
  );
  expect(session.status).toBe(202);
  workSessionId = ((await json(session)) as { id: string }).id;
});

afterAll(async () => {
  await close();
});

function branchRequest(userId: string, sessionId: string, branch: string) {
  return app.request(
    `/api/organizations/${organizationId}/work-sessions/${sessionId}/project/branch`,
    asUser(userId, jsonBody({ branch })),
  );
}

describe("a work session's git project", () => {
  it("is still preparing until a project has been built", async () => {
    const response = await branchRequest(owner, workSessionId, "feature/login");

    expect(response.status).toBe(400);
    expect(await json(response)).toMatchObject({
      error: { code: "VALIDATION_FAILED" },
    });
  });

  it("branches every repository once the project is ready", async () => {
    await db
      .update(workSessions)
      .set({
        status: "ready",
        projectBranch: "session/abcdef12",
        projectLocation: { kind: "local", path: "/tmp/project" },
      })
      .where(eq(workSessions.id, workSessionId));

    const response = await branchRequest(owner, workSessionId, "feature/login");

    expect(response.status).toBe(200);
    expect((await json(response)) as { projectBranch: string }).toMatchObject({
      projectBranch: "feature/login",
    });
    expect(branched.at(-1)).toEqual({
      location: { kind: "local", path: "/tmp/project" },
      branch: "feature/login",
    });
  });

  it("rejects a branch name git could not use", async () => {
    const response = await branchRequest(owner, workSessionId, "bad name~1");

    expect(response.status).toBe(400);
  });

  it("forbids a member, who may read but not act on resources", async () => {
    const response = await branchRequest(
      member,
      workSessionId,
      "feature/theirs",
    );

    expect(response.status).toBe(403);
  });

  it("hides a session belonging to another organization", async () => {
    const workspace = await app.request(
      `/api/organizations/${otherOrganizationId}/workspaces`,
      asUser(outsider, jsonBody({ name: "Theirs" })),
    );
    const workspaceId = ((await json(workspace)) as { id: string }).id;
    const session = await app.request(
      `/api/organizations/${otherOrganizationId}/work-sessions`,
      asUser(outsider, jsonBody({ workspaceId })),
    );
    const strangerSessionId = ((await json(session)) as { id: string }).id;

    // Addressed through an organization the caller owns, so this is a 404 about
    // the session rather than a 403 about the organization.
    const response = await branchRequest(
      owner,
      strangerSessionId,
      "feature/theirs",
    );

    expect(response.status).toBe(404);
  });
});
