import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "../db/client.js";
import * as schema from "../db/schema.js";
import { AppError } from "../errors.js";
import { materializeWorkSession } from "../jobs/materialize.js";

import { createTestDatabase, createTestUser } from "./helpers/harness.js";

describe("materializeWorkSession", () => {
  let db: Database;
  let close: () => Promise<void>;
  let workSessionId = "";

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
  });

  afterAll(async () => {
    await close();
  });

  it("moves a pending session to ready", async () => {
    const result = await materializeWorkSession(db, { workSessionId });
    expect(result?.status).toBe("ready");
    expect(result?.failureCode).toBeNull();
  });

  it("is idempotent for sessions it cannot claim", async () => {
    const result = await materializeWorkSession(db, { workSessionId });
    expect(result?.status).toBe("ready");
  });

  it("throws NOT_FOUND for unknown sessions", async () => {
    await expect(
      materializeWorkSession(db, { workSessionId: randomUUID() }),
    ).rejects.toThrow(AppError);
  });

  it("rejects malformed job payloads", async () => {
    await expect(
      materializeWorkSession(db, { workSessionId: "not-a-uuid" }),
    ).rejects.toThrow();
  });
});
