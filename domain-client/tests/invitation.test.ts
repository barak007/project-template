import { describe } from "vitest";

import { it } from "./kit/fixtures.js";

/**
 * Joining an organization, as both sides live it: an owner offers access to an
 * address, and the person who owns that address decides. Nothing in between
 * grants anything, which is what these stories are about.
 */
describe("invitation stories", () => {
  it.concurrent(
    "an invitation reaches the invited person's inbox and grants nothing yet",
    async ({ world, expect }) => {
      const owner = await world.founder("owner");
      const guest = await world.signedUpUser("guest");

      await owner.core.invitations.invite(owner.organization.id, {
        email: guest.credentials.email,
        role: "admin",
      });

      expect(owner.core.getState().invitations).toMatchObject([
        { email: guest.credentials.email, role: "admin", status: "pending" },
      ]);

      await guest.core.inbox.load();
      expect(guest.core.getState().inbox).toMatchObject([
        {
          kind: "organization-invitation",
          invitation: {
            organizationName: owner.organization.name,
            role: "admin",
            status: "pending",
          },
        },
      ]);
      // Invited is not joined: the organization is not theirs to see yet.
      await guest.core.organizations.load();
      expect(guest.core.getState().organizations).toEqual([]);
    },
  );

  it.concurrent(
    "accepting is what joins: the organization appears, with the role offered",
    async ({ world, expect }) => {
      const owner = await world.founder("owner");
      const guest = await world.invitedMember(owner, "admin", "joiner");

      await guest.core.organizations.load();
      expect(guest.core.getState().organizations).toMatchObject([
        { id: owner.organization.id },
      ]);

      await owner.core.members.load(owner.organization.id);
      expect(
        owner.core
          .getState()
          .members.map(({ role }) => role)
          .sort(),
      ).toEqual(["admin", "owner"]);

      // The offer has been answered, and cannot be answered again.
      await guest.core.inbox.load();
      expect(guest.core.getState().inbox[0]?.invitation.status).toBe(
        "accepted",
      );
      await expect(
        guest.core.inbox.respond(guest.invitationId, "accept"),
      ).rejects.toMatchObject({ code: "CONFLICT" });
    },
  );

  it.concurrent(
    "declining leaves them outside, and says so in their inbox",
    async ({ world, expect }) => {
      const owner = await world.founder("owner");
      const guest = await world.signedUpUser("decliner");
      await owner.core.invitations.invite(owner.organization.id, {
        email: guest.credentials.email,
        role: "member",
      });
      await guest.core.inbox.load();
      const waiting = guest.core.getState().inbox[0];
      if (!waiting) throw new Error("The invitation did not arrive");

      await guest.core.inbox.respond(waiting.invitation.id, "decline");

      expect(guest.core.getState().inbox[0]?.invitation.status).toBe(
        "declined",
      );
      await guest.core.organizations.load();
      expect(guest.core.getState().organizations).toEqual([]);
    },
  );

  it.concurrent(
    "an invitation sent before the account existed is waiting after sign-up",
    async ({ world, expect }) => {
      const owner = await world.founder("owner");
      const email = world.uniqueEmail("newcomer");

      await owner.core.invitations.invite(owner.organization.id, {
        email,
        role: "member",
      });

      // The person signs up afterwards; nothing reconciles this but reading.
      const core = world.newClient();
      await core.auth.signUp({
        email,
        password: "password-for-newcomer",
        name: "Newcomer",
      });
      await core.inbox.load();

      expect(core.getState().inbox).toMatchObject([
        { invitation: { organizationId: owner.organization.id } },
      ]);
    },
  );

  it.concurrent(
    "a revoked invitation is gone before it is answered",
    async ({ world, expect }) => {
      const owner = await world.founder("owner");
      const guest = await world.signedUpUser("late");
      await owner.core.invitations.invite(owner.organization.id, {
        email: guest.credentials.email,
        role: "member",
      });
      await guest.core.inbox.load();
      const waiting = guest.core.getState().inbox[0];
      if (!waiting) throw new Error("The invitation did not arrive");

      await owner.core.invitations.revoke(
        owner.organization.id,
        waiting.invitation.id,
      );

      expect(owner.core.getState().invitations[0]?.status).toBe("revoked");
      await expect(
        guest.core.inbox.respond(waiting.invitation.id, "accept"),
      ).rejects.toMatchObject({ code: "CONFLICT" });
    },
  );

  it.concurrent(
    "an invitation is answerable only by the address it names",
    async ({ world, expect }) => {
      const owner = await world.founder("owner");
      const guest = await world.signedUpUser("invited");
      const bystander = await world.signedUpUser("bystander");
      await owner.core.invitations.invite(owner.organization.id, {
        email: guest.credentials.email,
        role: "member",
      });
      await guest.core.inbox.load();
      const waiting = guest.core.getState().inbox[0];
      if (!waiting) throw new Error("The invitation did not arrive");

      // Not forbidden — someone else's invitation is not theirs to know about.
      await expect(
        bystander.core.inbox.respond(waiting.invitation.id, "accept"),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      // And nobody else's invitation shows up in their inbox.
      await bystander.core.inbox.load();
      expect(bystander.core.getState().inbox).toEqual([]);
    },
  );

  it.concurrent(
    "inviting somebody already in the organization is a conflict",
    async ({ world, expect }) => {
      const owner = await world.founder("owner");
      const member = await world.invitedMember(owner, "member", "already");

      await expect(
        owner.core.invitations.invite(owner.organization.id, {
          email: member.credentials.email,
          role: "admin",
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
    },
  );
});
