import { describe } from "vitest";

import { it } from "./kit/fixtures.js";

describe("membership stories", () => {
  it.concurrent(
    "an owner sees the roster, and so does everyone in it",
    async ({ world, expect }) => {
      const owner = await world.founder("owner");
      const member = await world.invitedMember(owner, "member", "reader");

      await owner.core.members.load(owner.organization.id);
      expect(
        owner.core
          .getState()
          .members.map(({ role }) => role)
          .sort(),
      ).toEqual(["member", "owner"]);

      // Membership is the only access control there is, so who else is in the
      // organization is not an owner's secret.
      await member.core.members.load(owner.organization.id);
      expect(member.core.getState().members).toHaveLength(2);
    },
  );

  it.concurrent(
    "a member can read resources but every mutation is forbidden",
    async ({ world, expect }) => {
      const owner = await world.founder("owner");
      const member = await world.invitedMember(owner, "member", "reader");
      const organization = owner.organization;
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
      // Managing who is in the organization is the owner's, invitations included.
      await expect(
        app.members.put(organization.id, {
          userId: "someone-else",
          role: "admin",
        }),
      ).rejects.toMatchObject(forbidden);
      await expect(
        app.invitations.invite(organization.id, {
          email: world.uniqueEmail("gate"),
          role: "member",
        }),
      ).rejects.toMatchObject(forbidden);
      await expect(app.invitations.load(organization.id)).rejects.toMatchObject(
        forbidden,
      );
    },
  );

  it.concurrent(
    "a role is changed in place, but nobody is added this way",
    async ({ world, expect }) => {
      const owner = await world.founder("owner");
      const member = await world.invitedMember(owner, "member", "promoted");
      const joined = member.core.getState().auth;
      if (joined.status !== "authenticated")
        throw new Error("The member is not signed in");

      await owner.core.members.put(owner.organization.id, {
        userId: joined.user.id,
        role: "admin",
      });
      expect(
        owner.core
          .getState()
          .members.find(({ userId }) => userId === joined.user.id)?.role,
      ).toBe("admin");

      // A user who never accepted anything is not a member, and cannot be made
      // one by naming them here.
      const stranger = await world.signedUpUser("stranger");
      const strangerAuth = stranger.core.getState().auth;
      if (strangerAuth.status !== "authenticated")
        throw new Error("The stranger is not signed in");
      await expect(
        owner.core.members.put(owner.organization.id, {
          userId: strangerAuth.user.id,
          role: "member",
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
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
