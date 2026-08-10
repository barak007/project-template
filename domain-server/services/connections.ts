import { and, desc, eq } from "drizzle-orm";

import type { Database } from "../db/client.js";
import { connections } from "../db/schema.js";
import type { ConnectionInput } from "../entities/connection.js";
import { AppError } from "../errors.js";
import type { GitProvider, GitProviders } from "../git/provider.js";

import { requireOrganizationPermission } from "./policy.js";

/**
 * A provider absent from the registry is one this deployment cannot use —
 * `github` before its credentials exist. That is a rejected request, not a
 * crash.
 */
export function requireProvider(
  providers: GitProviders,
  provider: keyof GitProviders,
): GitProvider {
  const implementation = providers[provider];
  if (!implementation)
    throw new AppError(
      "VALIDATION_FAILED",
      `The ${provider} provider is not available`,
      400,
    );
  return implementation;
}

export async function listConnections(
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
    .from(connections)
    .where(eq(connections.organizationId, organizationId))
    .orderBy(desc(connections.createdAt));
}

/**
 * Connecting is idempotent per provider: an organization has one connection to
 * each, so reconnecting with a new folder or a new installation replaces it
 * rather than accumulating.
 */
export async function putConnection(
  db: Database,
  providers: GitProviders,
  userId: string,
  organizationId: string,
  input: ConnectionInput,
) {
  await requireOrganizationPermission(
    db,
    userId,
    organizationId,
    "connection:manage",
  );
  const provider = requireProvider(providers, input.provider);
  const account = await provider.connect(input.config);
  const [connection] = await db
    .insert(connections)
    .values({
      organizationId,
      provider: input.provider,
      label: account.label,
      config: account.config,
    })
    .onConflictDoUpdate({
      target: [connections.organizationId, connections.provider],
      set: {
        label: account.label,
        config: account.config,
        updatedAt: new Date(),
      },
    })
    .returning();
  if (!connection)
    throw new AppError("INTERNAL_ERROR", "Could not save the connection", 500);
  return connection;
}

export async function deleteConnection(
  db: Database,
  userId: string,
  organizationId: string,
  connectionId: string,
) {
  await requireOrganizationPermission(
    db,
    userId,
    organizationId,
    "connection:manage",
  );
  const [connection] = await db
    .delete(connections)
    .where(
      and(
        eq(connections.id, connectionId),
        eq(connections.organizationId, organizationId),
      ),
    )
    .returning({ id: connections.id });
  if (!connection) throw new AppError("NOT_FOUND", "Connection not found", 404);
}
