import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

let db: Database;
let close: () => Promise<void>;
let app: ReturnType<typeof createTestApp>["app"];

const owner = "files-owner";
const member = "files-member";
const outsider = "files-outsider";
let organizationId = "";
let otherOrganizationId = "";
let workSessionId = "";
let preparingSessionId = "";
let projectPath = "";

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

async function createSession(
  userId: string,
  forOrganizationId: string,
  workspaceName: string,
) {
  const workspace = await app.request(
    `/api/organizations/${forOrganizationId}/workspaces`,
    asUser(userId, jsonBody({ name: workspaceName })),
  );
  const workspaceId = ((await json(workspace)) as { id: string }).id;
  const session = await app.request(
    `/api/organizations/${forOrganizationId}/work-sessions`,
    asUser(userId, jsonBody({ workspaceId })),
  );
  expect(session.status).toBe(202);
  return ((await json(session)) as { id: string }).id;
}

/** A session's project as the builder would have left it, minus git itself. */
async function writeProject() {
  const path = await mkdtemp(join(tmpdir(), "wwsa-files-"));
  await mkdir(join(path, "notes", "docs"), { recursive: true });
  await mkdir(join(path, ".git"), { recursive: true });
  await writeFile(join(path, "README.md"), "# Session\n", "utf8");
  await writeFile(join(path, ".git", "config"), "[core]\n", "utf8");
  await writeFile(join(path, "notes", "index.ts"), "export const a = 1;\n");
  await writeFile(
    join(path, "logo.png"),
    Buffer.from([0x89, 0x50, 0x00, 0x01]),
  );
  return path;
}

function listRequest(userId: string, sessionId: string, path: string) {
  return app.request(
    `/api/organizations/${organizationId}/work-sessions/${sessionId}/project/files?path=${encodeURIComponent(path)}`,
    asUser(userId),
  );
}

function fileRequest(userId: string, sessionId: string, path: string) {
  return app.request(
    `/api/organizations/${organizationId}/work-sessions/${sessionId}/project/file?path=${encodeURIComponent(path)}`,
    asUser(userId),
  );
}

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  ({ app } = createTestApp(db));
  for (const id of [owner, member, outsider]) await createTestUser(db, id);

  organizationId = await createOrganization(owner, "Acme Files");
  otherOrganizationId = await createOrganization(outsider, "Elsewhere");
  await app.request(
    `/api/organizations/${organizationId}/members`,
    asUser(owner, {
      ...jsonBody({ userId: member, role: "member" }),
      method: "PUT",
    }),
  );

  workSessionId = await createSession(owner, organizationId, "Platform");
  preparingSessionId = await createSession(owner, organizationId, "Preparing");
  projectPath = await writeProject();
  await db
    .update(workSessions)
    .set({
      status: "ready",
      projectLocation: { kind: "local", path: projectPath },
    })
    .where(eq(workSessions.id, workSessionId));
});

afterAll(async () => {
  await close();
});

describe("browsing a work session's project", () => {
  it("lists the root, folders first, without git's own directory", async () => {
    const response = await listRequest(owner, workSessionId, "");

    expect(response.status).toBe(200);
    expect(await json(response)).toEqual([
      { name: "notes", path: "notes", kind: "directory" },
      // Case-insensitive, like a file tree: logo before README.
      { name: "logo.png", path: "logo.png", kind: "file" },
      { name: "README.md", path: "README.md", kind: "file" },
    ]);
  });

  it("lists a subdirectory by its path, with paths that address it", async () => {
    const response = await listRequest(owner, workSessionId, "notes");

    expect(await json(response)).toEqual([
      { name: "docs", path: "notes/docs", kind: "directory" },
      { name: "index.ts", path: "notes/index.ts", kind: "file" },
    ]);
  });

  it("reads a file as text a viewer can show", async () => {
    const response = await fileRequest(owner, workSessionId, "notes/index.ts");

    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({
      path: "notes/index.ts",
      text: "export const a = 1;\n",
      truncated: false,
    });
  });

  it("lets a member read, because reading code is a read", async () => {
    const response = await fileRequest(member, workSessionId, "README.md");

    expect(response.status).toBe(200);
  });

  it("refuses a file that is not text", async () => {
    const response = await fileRequest(owner, workSessionId, "logo.png");

    expect(response.status).toBe(400);
  });

  it("refuses a path that climbs out of the project", async () => {
    const escape = await fileRequest(owner, workSessionId, "../../etc/hosts");

    expect(escape.status).toBe(404);
    const absolute = await fileRequest(owner, workSessionId, "/etc/hosts");
    expect(absolute.status).toBe(404);
  });

  it("says a session with no project yet is still being prepared", async () => {
    const response = await listRequest(owner, preparingSessionId, "");

    expect(response.status).toBe(400);
    expect(await json(response)).toMatchObject({
      error: { code: "VALIDATION_FAILED" },
    });
  });

  it("hides a session belonging to another organization", async () => {
    const stranger = await createSession(
      outsider,
      otherOrganizationId,
      "Theirs",
    );

    // Addressed through an organization the caller owns, so this is a 404 about
    // the session rather than a 403 about the organization.
    const response = await listRequest(owner, stranger, "");

    expect(response.status).toBe(404);
  });

  it("forbids someone outside the organization entirely", async () => {
    const response = await listRequest(outsider, workSessionId, "");

    expect(response.status).toBe(403);
  });
});
