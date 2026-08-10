import { and, eq, sql } from "drizzle-orm";

import type { Database } from "../db/client.js";
import { sources } from "../db/schema.js";
import type { RepositoryInput } from "../entities/repository.js";
import { repositoryName } from "../entities/repository.js";
import { AppError } from "../errors.js";

import { requireOrganizationPermission } from "./policy.js";

/**
 * Adds a repository to the organization by defining it: a remote URL becomes a
 * `git` source, which is what a workspace references and a session snapshots.
 *
 * Idempotent on the remote rather than on the name, because two repositories
 * can share a last path segment while being different repositories, and adding
 * the same URL twice is the user asking for the one they already have.
 */
export async function addRepository(
  db: Database,
  userId: string,
  organizationId: string,
  input: RepositoryInput,
) {
  await requireOrganizationPermission(
    db,
    userId,
    organizationId,
    "resource:write",
  );

  const [existing] = await db
    .select()
    .from(sources)
    .where(
      and(
        eq(sources.organizationId, organizationId),
        eq(sources.kind, "git"),
        sql`${sources.config} ->> 'remote' = ${input.remote}`,
      ),
    )
    .limit(1);
  if (existing) return existing;

  const [source] = await db
    .insert(sources)
    .values({
      organizationId,
      name: await availableName(
        db,
        organizationId,
        repositoryName(input.remote),
      ),
      kind: "git",
      config: input.ref
        ? { remote: input.remote, ref: input.ref }
        : { remote: input.remote },
    })
    .returning();
  if (!source)
    throw new AppError("INTERNAL_ERROR", "Could not add the repository", 500);
  return source;
}

/**
 * Names are unique per organization, so two different repositories called
 * `api` get `api` and `api-2` rather than the second one failing on a
 * constraint the user cannot see or fix.
 */
async function availableName(
  db: Database,
  organizationId: string,
  preferred: string,
): Promise<string> {
  const taken = await db
    .select({ name: sources.name })
    .from(sources)
    .where(eq(sources.organizationId, organizationId));
  const names = new Set(taken.map((row) => row.name));
  if (!names.has(preferred)) return preferred;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${preferred}-${suffix}`;
    if (!names.has(candidate)) return candidate;
  }
}
