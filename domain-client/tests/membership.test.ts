import { describe } from "vitest";

import { it } from "./kit/fixtures.js";
import type { World } from "./kit/world.js";

async function memberOf(world: World, ownerName: string, memberName: string) {
  const owner = await world.founder(ownerName);
  const member = await world.signedUpUser(memberName);
  const memberAuth = member.core.getState().auth;
  if (memberAuth.status !== "authenticated")
    throw new Error("Member persona is not signed in");
  await owner.core.members.put(owner.organization.id, {
    userId: memberAuth.user.id,
    role: "member",
  });
  return { owner, member, organization: owner.organization };
}

describe("membership stories", () => {
  it.concurrent(
    "an owner adds a member and sees the roster, which members may not read",
    async ({ world, expect }) => {
      const { owner, member, organization } = await memberOf(
        world,
        "owner",
        "reader",
      );

      await owner.core.members.load(organization.id);
      expect(
        owner.core
          .getState()
          .members.map(({ role }) => role)
          .sort(),
      ).toEqual(["member", "owner"]);

      // The roster is management-only: plain members cannot list memberships.
      await expect(
        member.core.members.load(organization.id),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    },
  );

  it.concurrent(
    "a member can read resources but every mutation is forbidden",
    async ({ world, expect }) => {
      const { owner, member, organization } = await memberOf(
        world,
        "owner",
        "reader",
      );
      await owner.core.sources.create(organization.id, {
        name: "repo",
        kind: "git",
        config: { remote: "https://example.test/repo.git" },
      });
      const source = owner.core.getState().sources[0];
      await owner.core.workspaces.create(organization.id, {
        name: "main",
        sourceIds: [],
      });
      const workspace = owner.core.getState().workspaces[0];
      if (!source || !workspace) throw new Error("Owner setup failed");

      await member.core.sources.load(organization.id);
      expect(member.core.getState().sources).toHaveLength(1);

      const forbidden = { code: "FORBIDDEN" };
      const app = member.core;
      const input = {
        name: "x",
        kind: "git" as const,
        config: { remote: "https://example.test/repo.git" },
      };
      await expect(
        app.sources.create(organization.id, input),
      ).rejects.toMatchObject(forbidden);
      await expect(
        app.sources.update(organization.id, source.id, input),
      ).rejects.toMatchObject(forbidden);
      await expect(
        app.sources.delete(organization.id, source.id),
      ).rejects.toMatchObject(forbidden);
      await expect(
        app.workspaces.create(organization.id, { name: "w", sourceIds: [] }),
      ).rejects.toMatchObject(forbidden);
      await expect(
        app.workspaces.update(organization.id, workspace.id, {
          name: "w",
          sourceIds: [],
        }),
      ).rejects.toMatchObject(forbidden);
      await expect(
        app.workspaces.delete(organization.id, workspace.id),
      ).rejects.toMatchObject(forbidden);
      await expect(
        app.workSessions.start(organization.id, workspace.id),
      ).rejects.toMatchObject(forbidden);
      await expect(
        app.organizationSecrets.put(organization.id, { key: "K", value: "v" }),
      ).rejects.toMatchObject(forbidden);
      await expect(
        app.organizationSecrets.delete(organization.id, "K"),
      ).rejects.toMatchObject(forbidden);
      await expect(
        app.organizationData.put(organization.id, { key: "K", value: 1 }),
      ).rejects.toMatchObject(forbidden);
      await expect(
        app.members.put(organization.id, {
          userId: "someone-else",
          role: "admin",
        }),
      ).rejects.toMatchObject(forbidden);
    },
  );

  it.concurrent(
    "an outsider cannot read anything in the organization",
    async ({ world, expect }) => {
      const { organization } = await world.founder("owner");
      const outsider = await world.signedUpUser("outsider");

      const forbidden = { code: "FORBIDDEN" };
      const app = outsider.core;
      await expect(app.members.load(organization.id)).rejects.toMatchObject(
        forbidden,
      );
      await expect(app.sources.load(organization.id)).rejects.toMatchObject(
        forbidden,
      );
      await expect(app.workspaces.load(organization.id)).rejects.toMatchObject(
        forbidden,
      );
      await expect(
        app.workSessions.load(organization.id),
      ).rejects.toMatchObject(forbidden);
      await expect(
        app.workSessions.refresh(organization.id, organization.id),
      ).rejects.toMatchObject(forbidden);
      await expect(
        app.organizationSecrets.load(organization.id),
      ).rejects.toMatchObject(forbidden);
      await expect(
        app.organizationData.load(organization.id),
      ).rejects.toMatchObject(forbidden);
    },
  );
});
