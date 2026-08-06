import { and, desc, eq } from "drizzle-orm";

import type { Database } from "../db/client.js";
import { sources } from "../db/schema.js";
import type { SourceInput } from "../entities/source.js";
import { AppError } from "../errors.js";

import { requireOrganizationPermission } from "./policy.js";

export async function listSources(
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
  return db
    .select()
    .from(sources)
    .where(eq(sources.organizationId, organizationId))
    .orderBy(desc(sources.createdAt));
}

export async function createSource(
  db: Database,
  userId: string,
  organizationId: string,
  input: SourceInput,
) {
  await requireOrganizationPermission(
    db,
    userId,
    organizationId,
    "resource:write",
  );
  const [source] = await db
    .insert(sources)
    .values({ ...input, organizationId })
    .returning();
  if (!source)
    throw new AppError("INTERNAL_ERROR", "Could not create source", 500);
  return source;
}

export async function updateSource(
  db: Database,
  userId: string,
  organizationId: string,
  sourceId: string,
  input: SourceInput,
) {
  await requireOrganizationPermission(
    db,
    userId,
    organizationId,
    "resource:write",
  );
  const [source] = await db
    .update(sources)
    .set({ ...input, updatedAt: new Date() })
    .where(
      and(eq(sources.id, sourceId), eq(sources.organizationId, organizationId)),
    )
    .returning();
  if (!source) throw new AppError("NOT_FOUND", "Source not found", 404);
  return source;
}

export async function deleteSource(
  db: Database,
  userId: string,
  organizationId: string,
  sourceId: string,
) {
  await requireOrganizationPermission(
    db,
    userId,
    organizationId,
    "resource:write",
  );
  const [source] = await db
    .delete(sources)
    .where(
      and(eq(sources.id, sourceId), eq(sources.organizationId, organizationId)),
    )
    .returning({ id: sources.id });
  if (!source) throw new AppError("NOT_FOUND", "Source not found", 404);
}
