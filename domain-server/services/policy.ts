import { and, eq, inArray, or } from "drizzle-orm";

import type { Database } from "../db/client.js";
import {
  organizationMembers,
  workspaces,
  workspaceUserGrants,
} from "../db/schema.js";
import type { WorkspaceRole } from "../db/schema.js";
import { AppError } from "../errors.js";

/**
 * What a role in an **organization** carries. These govern the organization
 * itself and the things it owns outright — its repositories, its secrets, its
 * data. What may be done with one workspace is a separate question, answered
 * below, because a workspace can be restricted to some of the people in the
 * organization.
 */
export type Permission =
  | "organization:read"
  | "organization:manage"
  | "source:read"
  | "source:write"
  | "secret:manage"
  | "workspace:create";

const permissions = {
  owner: new Set<Permission>([
    "organization:read",
    "organization:manage",
    "source:read",
    "source:write",
    "secret:manage",
    "workspace:create",
  ]),
  admin: new Set<Permission>([
    "organization:read",
    "source:read",
    "source:write",
    "secret:manage",
    "workspace:create",
  ]),
  // A member may make a workspace and manages what they make: without that,
  // per-workspace roles would only ever be something done *to* a member.
  member: new Set<Permission>([
    "organization:read",
    "source:read",
    "workspace:create",
  ]),
} as const;

/** What a role on **one workspace** carries. Ordered: each contains the last. */
export type WorkspacePermission =
  | "workspace:read"
  | "session:create"
  | "workspace:write"
  | "workspace:manage";

const workspacePermissions = {
  viewer: new Set<WorkspacePermission>(["workspace:read"]),
  operator: new Set<WorkspacePermission>(["workspace:read", "session:create"]),
  editor: new Set<WorkspacePermission>([
    "workspace:read",
    "session:create",
    "workspace:write",
  ]),
  manager: new Set<WorkspacePermission>([
    "workspace:read",
    "session:create",
    "workspace:write",
    "workspace:manage",
  ]),
} as const satisfies Record<WorkspaceRole, Set<WorkspacePermission>>;

/** Ascending, so resolution can take a maximum rather than special-case pairs. */
const rank: Record<WorkspaceRole, number> = {
  viewer: 0,
  operator: 1,
  editor: 2,
  manager: 3,
};

export async function requireOrganizationPermission(
  db: Database,
  userId: string,
  organizationId: string,
  permission: Permission,
) {
  const membership = await organizationMembership(db, userId, organizationId);
  if (!membership || !permissions[membership.role].has(permission)) {
    throw new AppError(
      "FORBIDDEN",
      "You do not have permission to perform this operation",
      403,
    );
  }
  return membership;
}

/**
 * The one role a user ends up with on one workspace: the **highest** of
 * everything that applies, or none.
 *
 * Grants only ever add. An organization's owners and admins are managers of
 * every workspace in it — a grant cannot take that away — and a workspace left
 * `organization`-visible is readable by every member, which is what the default
 * means.
 */
export async function resolveWorkspaceRole(
  db: Database,
  userId: string,
  organizationId: string,
  workspaceId: string,
): Promise<WorkspaceRole | undefined> {
  const membership = await organizationMembership(db, userId, organizationId);
  // Not in the organization: nothing inside it exists as far as they know.
  if (!membership) return undefined;
  if (membership.role === "owner" || membership.role === "admin")
    return "manager";

  const [workspace] = await db
    .select({ visibility: workspaces.visibility })
    .from(workspaces)
    .where(
      and(
        eq(workspaces.id, workspaceId),
        eq(workspaces.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!workspace) return undefined;

  const candidates: WorkspaceRole[] = [];
  if (workspace.visibility === "organization") candidates.push("viewer");
  const grants = await db
    .select({ role: workspaceUserGrants.role })
    .from(workspaceUserGrants)
    .where(
      and(
        eq(workspaceUserGrants.workspaceId, workspaceId),
        eq(workspaceUserGrants.userId, userId),
      ),
    );
  candidates.push(...grants.map((grant) => grant.role));
  return highest(candidates);
}

/**
 * The guard every workspace-scoped read and mutation calls first.
 *
 * A workspace nothing resolves on is a **404, not a 403**: a restricted
 * workspace behaves as if it does not exist, the same rule that already applies
 * to an id from another organization. Saying "forbidden" would confirm it is
 * there.
 */
export async function requireWorkspacePermission(
  db: Database,
  userId: string,
  organizationId: string,
  workspaceId: string,
  permission: WorkspacePermission,
) {
  const role = await resolveWorkspaceRole(
    db,
    userId,
    organizationId,
    workspaceId,
  );
  if (!role) throw new AppError("NOT_FOUND", "Workspace not found", 404);
  if (!workspacePermissions[role].has(permission))
    throw new AppError(
      "FORBIDDEN",
      "You do not have permission to perform this operation",
      403,
    );
  return role;
}

/**
 * The role this user holds on each of the given workspaces, absent where they
 * hold none. Two queries whatever the number of workspaces, so a list read
 * resolves every row without a permission check per row — and the row can then
 * tell the client what its reader may do with it, rather than leaving the UI to
 * re-derive the rule and guess wrong.
 */
export async function resolveWorkspaceRoles(
  db: Database,
  userId: string,
  organizationId: string,
  workspaceIds: string[],
): Promise<Map<string, WorkspaceRole>> {
  const roles = new Map<string, WorkspaceRole>();
  if (workspaceIds.length === 0) return roles;
  const membership = await organizationMembership(db, userId, organizationId);
  if (!membership) return roles;
  if (membership.role === "owner" || membership.role === "admin") {
    for (const id of workspaceIds) roles.set(id, "manager");
    return roles;
  }

  const [rows, grants] = await Promise.all([
    db
      .select({ id: workspaces.id, visibility: workspaces.visibility })
      .from(workspaces)
      .where(
        and(
          eq(workspaces.organizationId, organizationId),
          inArray(workspaces.id, workspaceIds),
        ),
      ),
    db
      .select({
        workspaceId: workspaceUserGrants.workspaceId,
        role: workspaceUserGrants.role,
      })
      .from(workspaceUserGrants)
      .where(
        and(
          eq(workspaceUserGrants.userId, userId),
          inArray(workspaceUserGrants.workspaceId, workspaceIds),
        ),
      ),
  ]);
  for (const row of rows)
    if (row.visibility === "organization") roles.set(row.id, "viewer");
  const known = new Set(rows.map((row) => row.id));
  for (const grant of grants) {
    if (!known.has(grant.workspaceId)) continue;
    const current = roles.get(grant.workspaceId);
    roles.set(
      grant.workspaceId,
      current === undefined ? grant.role : better(current, grant.role),
    );
  }
  return roles;
}

/**
 * Every workspace in the organization this user can see, as one query — a list
 * endpoint filters on this rather than resolving a role per row.
 */
export async function visibleWorkspaceIds(
  db: Database,
  userId: string,
  organizationId: string,
): Promise<string[]> {
  const membership = await organizationMembership(db, userId, organizationId);
  if (!membership) return [];
  const rows =
    membership.role === "owner" || membership.role === "admin"
      ? await db
          .select({ id: workspaces.id })
          .from(workspaces)
          .where(eq(workspaces.organizationId, organizationId))
      : await db
          .selectDistinct({ id: workspaces.id })
          .from(workspaces)
          .leftJoin(
            workspaceUserGrants,
            and(
              eq(workspaceUserGrants.workspaceId, workspaces.id),
              eq(workspaceUserGrants.userId, userId),
            ),
          )
          .where(
            and(
              eq(workspaces.organizationId, organizationId),
              or(
                eq(workspaces.visibility, "organization"),
                eq(workspaceUserGrants.userId, userId),
              ),
            ),
          );
  return rows.map((row) => row.id);
}

function better(one: WorkspaceRole, other: WorkspaceRole): WorkspaceRole {
  return rank[one] >= rank[other] ? one : other;
}

function highest(roles: WorkspaceRole[]): WorkspaceRole | undefined {
  return roles.reduce<WorkspaceRole | undefined>(
    (best, role) => (best === undefined ? role : better(best, role)),
    undefined,
  );
}

async function organizationMembership(
  db: Database,
  userId: string,
  organizationId: string,
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
  return membership;
}
