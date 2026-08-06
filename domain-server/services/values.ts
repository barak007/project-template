import { and, desc, eq } from "drizzle-orm";

import type { SecretCipher } from "../crypto/secrets.js";
import type { Database } from "../db/client.js";
import {
  organizationData,
  organizationSecrets,
  userData,
  userSecrets,
} from "../db/schema.js";
import type { DataInput, SecretInput } from "../entities/value.js";
import { AppError } from "../errors.js";

import { requireOrganizationPermission } from "./policy.js";

export async function listOrganizationSecrets(
  db: Database,
  userId: string,
  organizationId: string,
) {
  await requireOrganizationPermission(
    db,
    userId,
    organizationId,
    "secret:manage",
  );
  return db
    .select({
      id: organizationSecrets.id,
      key: organizationSecrets.key,
      createdAt: organizationSecrets.createdAt,
      updatedAt: organizationSecrets.updatedAt,
    })
    .from(organizationSecrets)
    .where(eq(organizationSecrets.organizationId, organizationId))
    .orderBy(desc(organizationSecrets.createdAt));
}

export async function putOrganizationSecret(
  db: Database,
  cipher: SecretCipher,
  userId: string,
  organizationId: string,
  input: SecretInput,
) {
  await requireOrganizationPermission(
    db,
    userId,
    organizationId,
    "secret:manage",
  );
  const encryptedValue = cipher.encrypt(input.value);
  const [row] = await db
    .insert(organizationSecrets)
    .values({ organizationId, key: input.key, encryptedValue })
    .onConflictDoUpdate({
      target: [organizationSecrets.organizationId, organizationSecrets.key],
      set: { encryptedValue, updatedAt: new Date() },
    })
    .returning({
      id: organizationSecrets.id,
      key: organizationSecrets.key,
      createdAt: organizationSecrets.createdAt,
      updatedAt: organizationSecrets.updatedAt,
    });
  if (!row) throw new AppError("INTERNAL_ERROR", "Could not store secret", 500);
  return row;
}

export async function listUserSecrets(db: Database, userId: string) {
  return db
    .select({
      id: userSecrets.id,
      key: userSecrets.key,
      createdAt: userSecrets.createdAt,
      updatedAt: userSecrets.updatedAt,
    })
    .from(userSecrets)
    .where(eq(userSecrets.userId, userId))
    .orderBy(desc(userSecrets.createdAt));
}

export async function putUserSecret(
  db: Database,
  cipher: SecretCipher,
  userId: string,
  input: SecretInput,
) {
  const encryptedValue = cipher.encrypt(input.value);
  const [row] = await db
    .insert(userSecrets)
    .values({ userId, key: input.key, encryptedValue })
    .onConflictDoUpdate({
      target: [userSecrets.userId, userSecrets.key],
      set: { encryptedValue, updatedAt: new Date() },
    })
    .returning({
      id: userSecrets.id,
      key: userSecrets.key,
      createdAt: userSecrets.createdAt,
      updatedAt: userSecrets.updatedAt,
    });
  if (!row) throw new AppError("INTERNAL_ERROR", "Could not store secret", 500);
  return row;
}

export async function deleteOrganizationSecret(
  db: Database,
  userId: string,
  organizationId: string,
  key: string,
) {
  await requireOrganizationPermission(
    db,
    userId,
    organizationId,
    "secret:manage",
  );
  const [row] = await db
    .delete(organizationSecrets)
    .where(
      and(
        eq(organizationSecrets.organizationId, organizationId),
        eq(organizationSecrets.key, key),
      ),
    )
    .returning({ id: organizationSecrets.id });
  if (!row) throw new AppError("NOT_FOUND", "Secret not found", 404);
}

export async function deleteUserSecret(
  db: Database,
  userId: string,
  key: string,
) {
  const [row] = await db
    .delete(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.key, key)))
    .returning({ id: userSecrets.id });
  if (!row) throw new AppError("NOT_FOUND", "Secret not found", 404);
}

export async function listOrganizationData(
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
    .select({
      id: organizationData.id,
      key: organizationData.key,
      value: organizationData.value,
      createdAt: organizationData.createdAt,
      updatedAt: organizationData.updatedAt,
    })
    .from(organizationData)
    .where(eq(organizationData.organizationId, organizationId))
    .orderBy(desc(organizationData.createdAt));
}

export async function putOrganizationData(
  db: Database,
  userId: string,
  organizationId: string,
  input: DataInput,
) {
  await requireOrganizationPermission(
    db,
    userId,
    organizationId,
    "resource:write",
  );
  const [row] = await db
    .insert(organizationData)
    .values({ organizationId, ...input })
    .onConflictDoUpdate({
      target: [organizationData.organizationId, organizationData.key],
      set: { value: input.value, updatedAt: new Date() },
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Could not store data", 500);
  return row;
}

export async function listUserData(db: Database, userId: string) {
  return db
    .select({
      id: userData.id,
      key: userData.key,
      value: userData.value,
      createdAt: userData.createdAt,
      updatedAt: userData.updatedAt,
    })
    .from(userData)
    .where(eq(userData.userId, userId))
    .orderBy(desc(userData.createdAt));
}

export async function putUserData(
  db: Database,
  userId: string,
  input: DataInput,
) {
  const [row] = await db
    .insert(userData)
    .values({ userId, ...input })
    .onConflictDoUpdate({
      target: [userData.userId, userData.key],
      set: { value: input.value, updatedAt: new Date() },
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Could not store data", 500);
  return row;
}
