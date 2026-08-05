import { and, desc, eq, inArray } from "drizzle-orm";

import type { SecretCipher } from "../crypto/secrets.js";
import type { Database } from "../db/client.js";
import {
  organizationData,
  organizationSecrets,
  sources,
  userData,
  userSecrets,
  workspaceSources,
  workspaces,
  workSessions,
  type JsonValue,
} from "../db/schema.js";
import { AppError } from "../errors.js";
import type { JobProducer } from "../jobs/queue.js";

import { requireOrganizationPermission } from "./policy.js";

function response(row: typeof workSessions.$inferSelect) {
  const { secretsSnapshot, ...safe } = row;
  return { ...safe, secretKeys: Object.keys(secretsSnapshot).sort() };
}

export async function listWorkSessions(
  db: Database,
  userId: string,
  organizationId: string,
) {
  await requireOrganizationPermission(
    db,
    userId,
    organizationId,
    "resource:read",
  );
  const rows = await db
    .select()
    .from(workSessions)
    .where(eq(workSessions.organizationId, organizationId))
    .orderBy(desc(workSessions.createdAt));
  return rows.map(response);
}

export async function getWorkSession(
  db: Database,
  userId: string,
  organizationId: string,
  workSessionId: string,
) {
  await requireOrganizationPermission(
    db,
    userId,
    organizationId,
    "resource:read",
  );
  const [row] = await db
    .select()
    .from(workSessions)
    .where(
      and(
        eq(workSessions.id, workSessionId),
        eq(workSessions.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!row) throw new AppError("NOT_FOUND", "Work session not found", 404);
  return response(row);
}

export async function createWorkSession(
  db: Database,
  cipher: SecretCipher,
  jobs: JobProducer,
  userId: string,
  organizationId: string,
  workspaceId: string,
) {
  await requireOrganizationPermission(
    db,
    userId,
    organizationId,
    "resource:write",
  );
  const created = await db.transaction(async (transaction) => {
    const [workspace] = await transaction
      .select()
      .from(workspaces)
      .where(
        and(
          eq(workspaces.id, workspaceId),
          eq(workspaces.organizationId, organizationId),
        ),
      )
      .limit(1);
    if (!workspace) throw new AppError("NOT_FOUND", "Workspace not found", 404);

    const links = await transaction
      .select()
      .from(workspaceSources)
      .where(eq(workspaceSources.workspaceId, workspaceId));
    const sourceRows =
      links.length === 0
        ? []
        : await transaction
            .select()
            .from(sources)
            .where(
              and(
                eq(sources.organizationId, organizationId),
                inArray(
                  sources.id,
                  links.map((link) => link.sourceId),
                ),
              ),
            );
    const [
      organizationSecretRows,
      userSecretRows,
      organizationDataRows,
      userDataRows,
    ] = await Promise.all([
      transaction
        .select()
        .from(organizationSecrets)
        .where(eq(organizationSecrets.organizationId, organizationId)),
      transaction
        .select()
        .from(userSecrets)
        .where(eq(userSecrets.userId, userId)),
      transaction
        .select()
        .from(organizationData)
        .where(eq(organizationData.organizationId, organizationId)),
      transaction.select().from(userData).where(eq(userData.userId, userId)),
    ]);

    const secretsSnapshot: Record<string, string> = {};
    for (const secret of [...organizationSecretRows, ...userSecretRows])
      secretsSnapshot[secret.key] = cipher.decrypt(secret.encryptedValue);
    const dataSnapshot: Record<string, JsonValue> = {};
    for (const item of [...organizationDataRows, ...userDataRows])
      dataSnapshot[item.key] = item.value;
    const sourcesSnapshot = sourceRows.map(({ id, name, kind, config }) => ({
      id,
      name,
      kind,
      config,
    }));
    const [row] = await transaction
      .insert(workSessions)
      .values({
        organizationId,
        workspaceId,
        createdByUserId: userId,
        sourcesSnapshot,
        secretsSnapshot,
        dataSnapshot,
      })
      .returning();
    if (!row)
      throw new AppError(
        "INTERNAL_ERROR",
        "Could not create work session",
        500,
      );
    return row;
  });

  try {
    await jobs.enqueueMaterialize({ workSessionId: created.id });
  } catch (error) {
    await db
      .update(workSessions)
      .set({
        status: "failed",
        failureCode: "QUEUE_UNAVAILABLE",
        updatedAt: new Date(),
      })
      .where(eq(workSessions.id, created.id));
    throw error;
  }
  return response(created);
}
