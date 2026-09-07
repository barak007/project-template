import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "../db/client.js";
import * as schema from "../db/schema.js";
import {
  requireOrganizationPermission,
  requireWorkspacePermission,
  resolveWorkspaceRole,
  resolveWorkspaceRoles,
  visibleWorkspaceIds,
} from "../services/policy.js";

import {
  createTestDatabase,
  createTestUser,
  joinOrganization,
} from "./helpers/harness.js";

const owner = "policy-owner";
const admin = "policy-admin";
const member = "policy-member";
// A member holding per-workspace grants, to tell grant access from org-role access.
const granted = "policy-granted";
// In the other organization only — a real user, just not one of ours.
const outsider = "policy-outsider";

let db: Database;
let close: () => Promise<void>;
let organizationId = "";
let otherOrganizationId = "";
/** `organization`-visible, no grants: what every member sees by default. */
let openWorkspaceId = "";
/** `restricted`, no grants: invisible to plain members. */
let restrictedWorkspaceId = "";
/** `restricted`, `granted` holds an editor grant. */
let grantedRestrictedWorkspaceId = "";
/** `organization`-visible, `granted` holds an operator grant on top. */
let grantedOpenWorkspaceId = "";
/** Lives in the other organization; `granted` even holds a grant on it. */
let foreignWorkspaceId = "";

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  for (const userId of [owner, admin, member, granted, outsider])
    await createTestUser(db, userId);

  const [organization] = await db
    .insert(schema.organizations)
    .values({ name: "Ours" })
    .returning();
  const [otherOrganization] = await db
    .insert(schema.organizations)
    .values({ name: "Theirs" })
    .returning();
  organizationId = organization!.id;
  otherOrganizationId = otherOrganization!.id;

  await joinOrganization(db, organizationId, owner, "owner");
  await joinOrganization(db, organizationId, admin, "admin");
  await joinOrganization(db, organizationId, member, "member");
  await joinOrganization(db, organizationId, granted, "member");
  await joinOrganization(db, otherOrganizationId, outsider, "member");

  const workspace = async (
    owningOrganizationId: string,
    name: string,
    visibility: "organization" | "restricted",
  ) => {
    const [row] = await db
      .insert(schema.workspaces)
      .values({ organizationId: owningOrganizationId, name, visibility })
      .returning();
    return row!.id;
  };
  openWorkspaceId = await workspace(organizationId, "open", "organization");
  restrictedWorkspaceId = await workspace(
    organizationId,
    "restricted",
    "restricted",
  );
  grantedRestrictedWorkspaceId = await workspace(
    organizationId,
    "granted-restricted",
    "restricted",
  );
  grantedOpenWorkspaceId = await workspace(
    organizationId,
    "granted-open",
    "organization",
  );
  foreignWorkspaceId = await workspace(
    otherOrganizationId,
    "foreign",
    "organization",
  );

  await db.insert(schema.workspaceUserGrants).values([
    {
      workspaceId: grantedRestrictedWorkspaceId,
      userId: granted,
      role: "editor",
    },
    { workspaceId: grantedOpenWorkspaceId, userId: granted, role: "operator" },
    // A grant no higher than what visibility already gives: adds nothing.
    { workspaceId: grantedOpenWorkspaceId, userId: member, role: "viewer" },
    // A grant in an organization the user is not even a member of: it must
    // never leak across the organization boundary.
    { workspaceId: foreignWorkspaceId, userId: granted, role: "manager" },
  ]);
});

afterAll(async () => {
  await close();
});

describe("requireOrganizationPermission", () => {
  it("returns the membership when the role carries the permission", async () => {
    const membership = await requireOrganizationPermission(
      db,
      owner,
      organizationId,
      "organization:manage",
    );
    expect(membership.role).toBe("owner");
    expect(membership.userId).toBe(owner);
    expect(membership.organizationId).toBe(organizationId);
  });

  it("reserves organization:manage for owners", async () => {
    await expect(
      requireOrganizationPermission(
        db,
        admin,
        organizationId,
        "organization:manage",
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
    await expect(
      requireOrganizationPermission(
        db,
        member,
        organizationId,
        "organization:manage",
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("gives admins everything but organization:manage", async () => {
    for (const permission of [
      "organization:read",
      "source:read",
      "source:write",
      "secret:manage",
      "workspace:create",
    ] as const) {
      const membership = await requireOrganizationPermission(
        db,
        admin,
        organizationId,
        permission,
      );
      expect(membership.role).toBe("admin");
    }
  });

  it("lets members read and create workspaces but not write sources or manage secrets", async () => {
    for (const permission of [
      "organization:read",
      "source:read",
      "workspace:create",
    ] as const) {
      const membership = await requireOrganizationPermission(
        db,
        member,
        organizationId,
        permission,
      );
      expect(membership.role).toBe("member");
    }
    for (const permission of ["source:write", "secret:manage"] as const)
      await expect(
        requireOrganizationPermission(db, member, organizationId, permission),
      ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("rejects a user from another organization even for reads", async () => {
    await expect(
      requireOrganizationPermission(
        db,
        outsider,
        organizationId,
        "organization:read",
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });
});

describe("resolveWorkspaceRole", () => {
  it("makes owners and admins managers of every workspace, grants or not", async () => {
    expect(
      await resolveWorkspaceRole(db, owner, organizationId, openWorkspaceId),
    ).toBe("manager");
    expect(
      await resolveWorkspaceRole(
        db,
        admin,
        organizationId,
        restrictedWorkspaceId,
      ),
    ).toBe("manager");
  });

  it("gives a plain member viewer on an organization-visible workspace", async () => {
    expect(
      await resolveWorkspaceRole(db, member, organizationId, openWorkspaceId),
    ).toBe("viewer");
  });

  it("resolves nothing on a restricted workspace without a grant", async () => {
    expect(
      await resolveWorkspaceRole(
        db,
        member,
        organizationId,
        restrictedWorkspaceId,
      ),
    ).toBeUndefined();
  });

  it("resolves a grant's role on a restricted workspace", async () => {
    expect(
      await resolveWorkspaceRole(
        db,
        granted,
        organizationId,
        grantedRestrictedWorkspaceId,
      ),
    ).toBe("editor");
  });

  it("takes the higher of visibility and a grant", async () => {
    // Operator grant beats the viewer that organization visibility gives.
    expect(
      await resolveWorkspaceRole(
        db,
        granted,
        organizationId,
        grantedOpenWorkspaceId,
      ),
    ).toBe("operator");
  });

  it("keeps the visibility role when a grant is no higher", async () => {
    expect(
      await resolveWorkspaceRole(
        db,
        member,
        organizationId,
        grantedOpenWorkspaceId,
      ),
    ).toBe("viewer");
  });

  it("resolves nothing for a non-member", async () => {
    expect(
      await resolveWorkspaceRole(db, outsider, organizationId, openWorkspaceId),
    ).toBeUndefined();
  });

  it("resolves nothing for a member on another organization's workspace, grant or not", async () => {
    expect(
      await resolveWorkspaceRole(
        db,
        granted,
        organizationId,
        foreignWorkspaceId,
      ),
    ).toBeUndefined();
  });

  it("resolves nothing on a workspace that does not exist", async () => {
    expect(
      await resolveWorkspaceRole(db, member, organizationId, randomUUID()),
    ).toBeUndefined();
  });

  it("resolves nothing even for an owner on a foreign or unknown workspace", async () => {
    expect(
      await resolveWorkspaceRole(db, owner, organizationId, foreignWorkspaceId),
    ).toBeUndefined();
    expect(
      await resolveWorkspaceRole(db, owner, organizationId, randomUUID()),
    ).toBeUndefined();
  });
});

describe("requireWorkspacePermission", () => {
  it("returns the resolved role when it carries the permission", async () => {
    expect(
      await requireWorkspacePermission(
        db,
        granted,
        organizationId,
        grantedRestrictedWorkspaceId,
        "workspace:write",
      ),
    ).toBe("editor");
    expect(
      await requireWorkspacePermission(
        db,
        member,
        organizationId,
        openWorkspaceId,
        "workspace:read",
      ),
    ).toBe("viewer");
    expect(
      await requireWorkspacePermission(
        db,
        owner,
        organizationId,
        restrictedWorkspaceId,
        "workspace:manage",
      ),
    ).toBe("manager");
  });

  it("answers 403 when the role exists but is too low", async () => {
    // A viewer may read, not write.
    await expect(
      requireWorkspacePermission(
        db,
        member,
        organizationId,
        openWorkspaceId,
        "workspace:write",
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
    // An operator may open sessions, not manage.
    await expect(
      requireWorkspacePermission(
        db,
        granted,
        organizationId,
        grantedOpenWorkspaceId,
        "workspace:manage",
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
    // An editor may write, not manage.
    await expect(
      requireWorkspacePermission(
        db,
        granted,
        organizationId,
        grantedRestrictedWorkspaceId,
        "workspace:manage",
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("answers 404, not 403, when nothing resolves", async () => {
    // A restricted workspace behaves as if it does not exist.
    await expect(
      requireWorkspacePermission(
        db,
        member,
        organizationId,
        restrictedWorkspaceId,
        "workspace:read",
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
    // So does another organization's workspace.
    await expect(
      requireWorkspacePermission(
        db,
        member,
        organizationId,
        foreignWorkspaceId,
        "workspace:read",
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
    // And everything, to someone outside the organization.
    await expect(
      requireWorkspacePermission(
        db,
        outsider,
        organizationId,
        openWorkspaceId,
        "workspace:read",
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });
});

describe("resolveWorkspaceRoles", () => {
  it("returns an empty map for no workspaces and for non-members", async () => {
    expect(await resolveWorkspaceRoles(db, member, organizationId, [])).toEqual(
      new Map(),
    );
    expect(
      await resolveWorkspaceRoles(db, outsider, organizationId, [
        openWorkspaceId,
      ]),
    ).toEqual(new Map());
  });

  it("marks owners and admins manager of every requested workspace", async () => {
    const roles = await resolveWorkspaceRoles(db, admin, organizationId, [
      openWorkspaceId,
      restrictedWorkspaceId,
    ]);
    expect(roles).toEqual(
      new Map([
        [openWorkspaceId, "manager"],
        [restrictedWorkspaceId, "manager"],
      ]),
    );
  });

  it("resolves a member's roles per workspace, absent where they hold none", async () => {
    const roles = await resolveWorkspaceRoles(db, granted, organizationId, [
      openWorkspaceId,
      restrictedWorkspaceId,
      grantedRestrictedWorkspaceId,
      grantedOpenWorkspaceId,
    ]);
    expect(roles).toEqual(
      new Map([
        [openWorkspaceId, "viewer"],
        [grantedRestrictedWorkspaceId, "editor"],
        [grantedOpenWorkspaceId, "operator"],
      ]),
    );
  });

  it("ignores workspaces from other organizations, even granted ones", async () => {
    const roles = await resolveWorkspaceRoles(db, granted, organizationId, [
      foreignWorkspaceId,
      grantedRestrictedWorkspaceId,
    ]);
    expect(roles).toEqual(new Map([[grantedRestrictedWorkspaceId, "editor"]]));
  });

  it("ignores foreign and unknown workspaces even for an owner", async () => {
    const roles = await resolveWorkspaceRoles(db, owner, organizationId, [
      openWorkspaceId,
      foreignWorkspaceId,
      randomUUID(),
    ]);
    expect(roles).toEqual(new Map([[openWorkspaceId, "manager"]]));
  });
});

describe("visibleWorkspaceIds", () => {
  it("shows owners and admins everything in the organization and nothing beyond it", async () => {
    const ids = await visibleWorkspaceIds(db, owner, organizationId);
    expect(ids.sort()).toEqual(
      [
        openWorkspaceId,
        restrictedWorkspaceId,
        grantedRestrictedWorkspaceId,
        grantedOpenWorkspaceId,
      ].sort(),
    );
  });

  it("shows a plain member only organization-visible workspaces", async () => {
    const ids = await visibleWorkspaceIds(db, member, organizationId);
    expect(ids.sort()).toEqual(
      [openWorkspaceId, grantedOpenWorkspaceId].sort(),
    );
  });

  it("adds granted restricted workspaces, without duplicating granted open ones", async () => {
    const ids = await visibleWorkspaceIds(db, granted, organizationId);
    expect(ids.sort()).toEqual(
      [
        openWorkspaceId,
        grantedOpenWorkspaceId,
        grantedRestrictedWorkspaceId,
      ].sort(),
    );
  });

  it("shows a non-member nothing", async () => {
    expect(await visibleWorkspaceIds(db, outsider, organizationId)).toEqual([]);
  });
});
