import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "../db/client.js";
import * as schema from "../db/schema.js";
import { AppError } from "../errors.js";
import { materializeWorkSession, sessionBranch } from "../jobs/materialize.js";

import { createTestDatabase, createTestUser } from "./helpers/harness.js";
import { recordingProjectBuilder } from "./helpers/project-builder.js";

describe("materializeWorkSession", () => {
  let db: Database;
  let close: () => Promise<void>;
  let workSessionId = "";
  let organizationId = "";
  let workspaceId = "";
  const { projectBuilder, ensured, cloned } = recordingProjectBuilder();

  beforeAll(async () => {
    ({ db, close } = await createTestDatabase());
    await createTestUser(db, "worker-user");
    const [organization] = await db
      .insert(schema.organizations)
      .values({ name: "Org" })
      .returning();
    const [workspace] = await db
      .insert(schema.workspaces)
      .values({ organizationId: organization!.id, name: "main" })
      .returning();
    const [session] = await db
      .insert(schema.workSessions)
      .values({
        organizationId: organization!.id,
        workspaceId: workspace!.id,
        createdByUserId: "worker-user",
        sourcesSnapshot: [],
        secretsSnapshot: {},
        dataSnapshot: {},
      })
      .returning();
    workSessionId = session!.id;
    organizationId = organization!.id;
    workspaceId = workspace!.id;
  });

  afterAll(async () => {
    await close();
  });

  it("builds the session's project and moves it to ready", async () => {
    const result = await materializeWorkSession(db, projectBuilder, {
      workSessionId,
    });
    expect(result?.status).toBe("ready");
    expect(result?.failureCode).toBeNull();
    // Where the project landed is what a client needs to open it.
    expect(result?.projectLocation).toEqual({
      kind: "local",
      path: `/tmp/sessions/${workSessionId}`,
    });
    expect(result?.projectBranch).toBe(sessionBranch(workSessionId));
    // The workspace project first, then a clone of it for this session.
    expect(ensured).toHaveLength(1);
    expect(ensured[0]?.workspaceName).toBe("main");
    expect(cloned).toHaveLength(1);
    expect(cloned[0]?.project).toEqual({
      kind: "local",
      path: `/tmp/${workspaceId}/project`,
    });

    // Where the workspace's project lives is remembered, so the next session
    // clones it instead of building again.
    const [workspace] = await db
      .select()
      .from(schema.workspaces)
      .where(eq(schema.workspaces.id, workspaceId));
    expect(workspace?.projectLocation).toEqual({
      kind: "local",
      path: `/tmp/${workspaceId}/project`,
    });

    // Progress is readable while it runs, not only after it finishes.
    expect(result?.progress.map(({ step }) => step)).toContain("Session ready");
  });

  it("is idempotent for sessions it cannot claim", async () => {
    const result = await materializeWorkSession(db, projectBuilder, {
      workSessionId,
    });
    expect(result?.status).toBe("ready");
    // A claim that fails must not rebuild: the project already exists.
    expect(ensured).toHaveLength(1);
    expect(cloned).toHaveLength(1);
  });

  it("builds only the git sources the snapshot can be cloned from", async () => {
    const [session] = await db
      .insert(schema.workSessions)
      .values({
        organizationId,
        workspaceId,
        createdByUserId: "worker-user",
        sourcesSnapshot: [
          {
            id: randomUUID(),
            name: "engine",
            kind: "git",
            config: { remote: "https://example.test/engine.git", ref: "main" },
          },
          // Not a git source: a session may hold a database too.
          { id: randomUUID(), name: "warehouse", kind: "database", config: {} },
          // A git source written before the config shape was validated: skipped
          // rather than failing a session that has other repositories.
          { id: randomUUID(), name: "legacy", kind: "git", config: {} },
        ],
        secretsSnapshot: {},
        dataSnapshot: {},
      })
      .returning();

    const result = await materializeWorkSession(db, projectBuilder, {
      workSessionId: session!.id,
    });

    expect(result?.status).toBe("ready");
    expect(ensured.at(-1)?.repositories).toEqual([
      {
        name: "engine",
        remote: "https://example.test/engine.git",
        ref: "main",
      },
    ]);
  });

  it("throws NOT_FOUND for unknown sessions", async () => {
    await expect(
      materializeWorkSession(db, projectBuilder, {
        workSessionId: randomUUID(),
      }),
    ).rejects.toThrow(AppError);
  });

  it("rejects malformed job payloads", async () => {
    await expect(
      materializeWorkSession(db, projectBuilder, {
        workSessionId: "not-a-uuid",
      }),
    ).rejects.toThrow();
  });

  it("marks the session failed when the project cannot be built", async () => {
    const [session] = await db
      .insert(schema.workSessions)
      .values({
        organizationId,
        workspaceId,
        createdByUserId: "worker-user",
        sourcesSnapshot: [],
        secretsSnapshot: {},
        dataSnapshot: {},
      })
      .returning();
    const failing = {
      ensureWorkspaceProject: () => Promise.reject(new Error("git exploded")),
      cloneForSession: () => Promise.reject(new Error("unreachable")),
      branchAll: () => Promise.resolve(),
    };

    await expect(
      materializeWorkSession(db, failing, { workSessionId: session!.id }),
    ).rejects.toThrow();

    const [row] = await db
      .select()
      .from(schema.workSessions)
      .where(eq(schema.workSessions.id, session!.id));
    expect(row?.status).toBe("failed");
    expect(row?.failureCode).toBe("PROJECT_BUILD_FAILED");
    expect(row?.projectLocation).toBeNull();
    // Why it failed is on the session, so a user is not left with only "Failed".
    expect(row?.progress.at(-1)).toMatchObject({ step: "Failed" });
  });
});
