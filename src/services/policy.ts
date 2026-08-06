import { and, eq } from "drizzle-orm";

import type { Database } from "../db/client.js";
import { organizationMembers, platformAdmins } from "../db/schema.js";
import { AppError } from "../errors.js";

export type Permission =
  | "organization:read"
  | "organization:manage"
  | "resource:read"
  | "resource:write"
  | "secret:manage";

const permissions = {
  owner: new Set<Permission>([
    "organization:read",
    "organization:manage",
    "resource:read",
    "resource:write",
    "secret:manage",
  ]),
  admin: new Set<Permission>([
    "organization:read",
    "resource:read",
    "resource:write",
    "secret:manage",
  ]),
  member: new Set<Permission>(["organization:read", "resource:read"]),
} as const;

export async function requireOrganizationPermission(
  db: Database,
  userId: string,
  organizationId: string,
  permission: Permission,
) {
  const [membership] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!membership || !permissions[membership.role].has(permission)) {
    throw new AppError(
      "FORBIDDEN",
      "You do not have permission to perform this operation",
      403,
    );
  }
  return membership;
}

export async function requirePlatformAdmin(db: Database, userId: string) {
  const [grant] = await db
    .select()
    .from(platformAdmins)
    .where(eq(platformAdmins.userId, userId))
    .limit(1);
  if (!grant) {
    throw new AppError(
      "FORBIDDEN",
      "You do not have permission to perform this operation",
      403,
    );
  }
}
