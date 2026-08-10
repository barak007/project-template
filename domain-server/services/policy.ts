import { and, eq } from "drizzle-orm";

import type { Database } from "../db/client.js";
import { organizationMembers } from "../db/schema.js";
import { AppError } from "../errors.js";

export type Permission =
  | "organization:read"
  | "organization:manage"
  | "resource:read"
  | "resource:write"
  | "secret:manage"
  | "connection:manage";

const permissions = {
  owner: new Set<Permission>([
    "organization:read",
    "organization:manage",
    "resource:read",
    "resource:write",
    "secret:manage",
    "connection:manage",
  ]),
  admin: new Set<Permission>([
    "organization:read",
    "resource:read",
    "resource:write",
    "secret:manage",
    "connection:manage",
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
