import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { SecretCipher } from "../src/crypto/secrets.js";
import {
  organizationData,
  organizationMembers,
  organizationSecrets,
  organizations,
  sources,
  user,
  userData,
  userSecrets,
  workspaceSources,
  workspaces,
  workSessions,
} from "../src/db/schema.js";
import * as schema from "../src/db/schema.js";
import type { JobProducer } from "../src/jobs/queue.js";
import { createWorkSession } from "../src/services/work-sessions.js";

const databaseUrl = process.env.DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;

integration("work-session snapshots", () => {
  const client = postgres(databaseUrl ?? "postgres://unused");
  const db = drizzle(client, { schema });
  const cipher = new SecretCipher(Buffer.alloc(32, 9).toString("base64"));
  const userId = `integration-${randomUUID()}`;
  let organizationId = "";
  let workspaceId = "";
  const enqueued: string[] = [];
  const jobs: JobProducer = {
    enqueueMaterialize: ({ workSessionId }) => {
      enqueued.push(workSessionId);
      return Promise.resolve(workSessionId);
    },
  };

  beforeAll(async () => {
    await db.insert(user).values({
      id: userId,
      name: "Integration User",
      email: `${userId}@example.test`,
    });
    const [organization] = await db
      .insert(organizations)
      .values({ name: "Integration Org" })
      .returning();
    if (!organization) throw new Error("Organization fixture failed");
    organizationId = organization.id;
    await db
      .insert(organizationMembers)
      .values({ organizationId, userId, role: "owner" });
    const [source] = await db
      .insert(sources)
      .values({
        organizationId,
        name: "repo",
        kind: "git",
        config: { url: "https://example.test/repo.git" },
      })
      .returning();
    const [workspace] = await db
      .insert(workspaces)
      .values({ organizationId, name: "main" })
      .returning();
    if (!source || !workspace) throw new Error("Workspace fixtures failed");
    workspaceId = workspace.id;
    await db
      .insert(workspaceSources)
      .values({ workspaceId, sourceId: source.id });
    await db.insert(organizationSecrets).values({
      organizationId,
      key: "TOKEN",
      encryptedValue: cipher.encrypt("organization"),
    });
    await db
      .insert(userSecrets)
      .values({ userId, key: "TOKEN", encryptedValue: cipher.encrypt("user") });
    await db
      .insert(organizationData)
      .values({ organizationId, key: "theme", value: "light" });
    await db.insert(userData).values({ userId, key: "theme", value: "dark" });
  });

  afterAll(async () => {
    if (organizationId)
      await db
        .delete(organizations)
        .where(eq(organizations.id, organizationId));
    await db.delete(user).where(eq(user.id, userId));
    await client.end();
  });

  it("copies sources and applies user-over-organization precedence", async () => {
    const created = await createWorkSession(
      db,
      jobs,
      userId,
      organizationId,
      workspaceId,
    );
    expect(created.secretKeys).toEqual(["TOKEN"]);
    expect(created.dataSnapshot).toEqual({ theme: "dark" });
    expect(created.sourcesSnapshot).toHaveLength(1);
    expect(enqueued).toEqual([created.id]);

    await db
      .update(userSecrets)
      .set({ encryptedValue: cipher.encrypt("changed") })
      .where(eq(userSecrets.userId, userId));
    await db
      .update(userData)
      .set({ value: "changed" })
      .where(eq(userData.userId, userId));
    const [persisted] = await db
      .select()
      .from(workSessions)
      .where(eq(workSessions.id, created.id));
    expect(cipher.decrypt(persisted?.secretsSnapshot.TOKEN ?? "")).toBe("user");
    expect(persisted?.dataSnapshot).toEqual({ theme: "dark" });
  });
});
