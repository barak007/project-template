import { and, eq } from "drizzle-orm";

import type { Database } from "../db/client.js";
import { connections, sources } from "../db/schema.js";
import type { RepositoryImport } from "../entities/repository.js";
import { AppError } from "../errors.js";
import type { GitProviders, RemoteRepository } from "../git/provider.js";

import { requireProvider } from "./connections.js";
import { requireOrganizationPermission } from "./policy.js";

type AvailableRepository = RemoteRepository & { connectionId: string };

/**
 * Every repository the organization's connections expose. The product calls
 * these repositories; only importing one turns it into a `git` source, which
 * is what a workspace references and a work session snapshots.
 */
export async function listRepositories(
  db: Database,
  providers: GitProviders,
  userId: string,
  organizationId: string,
): Promise<AvailableRepository[]> {
  await requireOrganizationPermission(
    db,
    userId,
    organizationId,
    "resource:read",
  );
  const connected = await db
    .select()
    .from(connections)
    .where(eq(connections.organizationId, organizationId));

  const available: AvailableRepository[] = [];
  for (const connection of connected) {
    // A provider that has been removed from this deployment leaves its
    // connection listed but contributes nothing, rather than failing the page.
    const provider = providers[connection.provider];
    if (!provider) continue;
    const repositories = await provider.listRepositories(connection.config);
    for (const repository of repositories)
      available.push({ ...repository, connectionId: connection.id });
  }
  return available;
}

/**
 * Turns one exposed repository into a source the organization owns. Importing
 * the same repository twice returns the source that already exists — a user
 * adding it to a second workspace is not creating a second copy.
 */
export async function importRepository(
  db: Database,
  providers: GitProviders,
  userId: string,
  organizationId: string,
  input: RepositoryImport,
) {
  await requireOrganizationPermission(
    db,
    userId,
    organizationId,
    "resource:write",
  );
  const [connection] = await db
    .select()
    .from(connections)
    .where(
      and(
        eq(connections.id, input.connectionId),
        eq(connections.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!connection) throw new AppError("NOT_FOUND", "Connection not found", 404);

  const provider = requireProvider(providers, connection.provider);
  const repositories = await provider.listRepositories(connection.config);
  const repository = repositories.find(
    (candidate) => candidate.externalId === input.externalId,
  );
  if (!repository) throw new AppError("NOT_FOUND", "Repository not found", 404);

  const [existing] = await db
    .select()
    .from(sources)
    .where(
      and(
        eq(sources.organizationId, organizationId),
        eq(sources.name, repository.name),
      ),
    )
    .limit(1);
  if (existing) return existing;

  const [source] = await db
    .insert(sources)
    .values({
      organizationId,
      name: repository.name,
      kind: "git",
      config: {
        provider: connection.provider,
        connectionId: connection.id,
        externalId: repository.externalId,
        remote: repository.remote,
      },
    })
    .returning();
  if (!source)
    throw new AppError(
      "INTERNAL_ERROR",
      "Could not import the repository",
      500,
    );
  return source;
}
