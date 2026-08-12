import { describe } from "vitest";

import { it } from "../../domain-client/tests/kit/fixtures.js";
import {
  actionKeys,
  hasLoaded,
  isPending,
  loadKeys,
  managesOrganization,
} from "../client/index.js";

import { signIn, visit } from "./harness.js";

/**
 * Inviting someone, and being invited — the two halves of the only way into an
 * organization. Both are flows through the store: the form, what is waiting,
 * and what the page can say while the server is answering.
 */
describe("inviting people into an organization", () => {
  it.concurrent(
    "an owner types an address, sends it, and the form empties",
    async ({ world, expect }) => {
      const founder = await world.founder("ada");
      const guest = await world.signedUpUser("grace");
      const { core } = visit(world, "/sign-in");
      await signIn(core, founder.credentials);
      const organizationId = founder.organization.id;
      await core.members.load(organizationId);

      core.invitations.startInviting();
      core.invitations.changeDraft({
        email: guest.credentials.email,
        role: "admin",
      });
      const sending = core.invitations.invite(organizationId);
      expect(isPending(core.getState(), actionKeys.invite)).toBe(true);
      await sending;

      expect(core.getState().error).toBeNull();
      expect(core.getState().invitations).toMatchObject([
        { email: guest.credentials.email, role: "admin", status: "pending" },
      ]);
      // Ready for the next one, and the form is closed again.
      expect(core.getState().inviteDraft).toEqual({
        email: "",
        role: "member",
      });
      expect(core.getState().openForm).toBeNull();
    },
  );

  it.concurrent(
    "an invitation the owner withdraws is answered by nobody",
    async ({ world, expect }) => {
      const founder = await world.founder("ada");
      const { core } = visit(world, "/sign-in");
      await signIn(core, founder.credentials);
      const organizationId = founder.organization.id;

      core.invitations.changeDraft({ email: world.uniqueEmail("late") });
      await core.invitations.invite(organizationId);
      await core.invitations.load(organizationId);
      const invitation = core.getState().invitations[0];
      if (!invitation) throw new Error("The invitation was not sent");

      await core.invitations.revoke(organizationId, invitation.id);

      expect(core.getState().invitations[0]?.status).toBe("revoked");
      expect(
        hasLoaded(core.getState(), loadKeys.invitations(organizationId)),
      ).toBe(true);
    },
  );

  it.concurrent(
    "an empty address is not a request the page makes",
    async ({ world, expect }) => {
      const founder = await world.founder("ada");
      const { core } = visit(world, "/sign-in");
      await signIn(core, founder.credentials);

      core.invitations.changeDraft({ email: "   " });
      await core.invitations.invite(founder.organization.id);

      expect(core.getState().invitations).toEqual([]);
      expect(core.getState().error).toBeNull();
    },
  );

  it.concurrent(
    "only an owner is offered the invitations section",
    async ({ world, expect }) => {
      const founder = await world.founder("ada");
      const member = await world.invitedMember(founder, "member", "grace");
      const { core } = visit(world, "/sign-in");
      await signIn(core, member.credentials);
      const organizationId = founder.organization.id;

      await core.members.load(organizationId);

      // The page reads this to decide, so a member is never shown a section the
      // server would refuse.
      expect(managesOrganization(core.getState())).toBe(false);
      await core.invitations.load(organizationId);
      expect(core.getState().error?.code).toBe("FORBIDDEN");
    },
  );
});

describe("being invited", () => {
  it.concurrent(
    "the dashboard shows what is waiting, and accepting joins",
    async ({ world, expect }) => {
      const founder = await world.founder("ada");
      const guest = await world.signedUpUser("grace");
      await founder.core.invitations.invite(founder.organization.id, {
        email: guest.credentials.email,
        role: "member",
      });

      const { core } = visit(world, "/sign-in");
      await signIn(core, guest.credentials);
      await core.inbox.load();

      expect(hasLoaded(core.getState(), loadKeys.inbox)).toBe(true);
      const waiting = core.getState().inbox[0];
      if (!waiting) throw new Error("Nothing was waiting in the inbox");
      expect(waiting.invitation.organizationName).toBe(
        founder.organization.name,
      );

      const answering = core.inbox.respond(waiting.invitation.id, "accept");
      expect(
        isPending(
          core.getState(),
          actionKeys.answerInvitation(waiting.invitation.id),
        ),
      ).toBe(true);
      await answering;

      // The row says what happened, and the organization is now theirs to open.
      expect(core.getState().inbox[0]?.invitation.status).toBe("accepted");
      expect(core.getState().organizations).toMatchObject([
        { id: founder.organization.id },
      ]);
    },
  );

  it.concurrent(
    "declining says so and joins nothing",
    async ({ world, expect }) => {
      const founder = await world.founder("ada");
      const guest = await world.signedUpUser("grace");
      await founder.core.invitations.invite(founder.organization.id, {
        email: guest.credentials.email,
        role: "member",
      });
      const { core } = visit(world, "/sign-in");
      await signIn(core, guest.credentials);
      await core.inbox.load();
      const waiting = core.getState().inbox[0];
      if (!waiting) throw new Error("Nothing was waiting in the inbox");

      await core.inbox.respond(waiting.invitation.id, "decline");

      expect(core.getState().inbox[0]?.invitation.status).toBe("declined");
      expect(core.getState().organizations).toEqual([]);
      expect(core.getState().error).toBeNull();
    },
  );

  it.concurrent(
    "an inbox with nothing in it is not a failure",
    async ({ world, expect }) => {
      const { credentials } = await world.signedUpUser("alone");
      const { core } = visit(world, "/sign-in");
      await signIn(core, credentials);

      await core.inbox.load();

      expect(core.getState().inbox).toEqual([]);
      expect(core.getState().error).toBeNull();
      expect(hasLoaded(core.getState(), loadKeys.inbox)).toBe(true);
    },
  );
});
