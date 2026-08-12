import { describe } from "vitest";

import { it } from "../../domain-client/tests/kit/fixtures.js";
import { actionKeys, hasLoaded, isPending, loadKeys } from "../client/index.js";
import type { AppCore } from "../client/index.js";

import { signIn, visit } from "./harness.js";

/**
 * Who can reach an organization. Membership is the app's only access control —
 * a workspace has none of its own — so this is the one list the product has, and
 * it lives on the organization's page.
 */
describe("the members of an organization", () => {
  it.concurrent(
    "the founder is a member of their own organization, as its owner",
    async ({ world, expect }) => {
      const founder = await world.founder("ada");
      const { core } = visit(world, "/sign-in");
      await signIn(core, founder.credentials);
      const organizationId = founder.organization.id;

      await core.members.load(organizationId);

      expect(hasLoaded(core.getState(), loadKeys.members(organizationId))).toBe(
        true,
      );
      expect(core.getState().members).toHaveLength(1);
      expect(core.getState().members[0]?.role).toBe("owner");
    },
  );

  it.concurrent(
    "a role is set in place, and the row says so while it is being set",
    async ({ world, expect }) => {
      const founder = await world.founder("ada");
      // Nobody is added by id any more: the joiner is someone who accepted an
      // invitation, which is the only way into the list.
      const joiner = await world.invitedMember(founder, "member", "grace");
      const joinerSession = visit(world, "/sign-in");
      await signIn(joinerSession.core, joiner.credentials);
      const userId = signedInId(joinerSession.core);
      if (userId === null) throw new Error("the joiner is not signed in");

      const { core } = visit(world, "/sign-in");
      await signIn(core, founder.credentials);
      const organizationId = founder.organization.id;

      const changing = core.members.changeRole(organizationId, userId, "admin");
      expect(isPending(core.getState(), actionKeys.changeRole(userId))).toBe(
        true,
      );
      await changing;

      // The control is free again whatever the answer was, and the list holds it.
      expect(isPending(core.getState(), actionKeys.changeRole(userId))).toBe(
        false,
      );
      expect(core.getState().error).toBeNull();
      expect(
        core.getState().members.find((member) => member.userId === userId)
          ?.role,
      ).toBe("admin");
    },
  );

  it.concurrent(
    "another organization's members are a failure the page can show",
    async ({ world, expect }) => {
      const stranger = await world.founder("ada");
      const { credentials } = await world.signedUpUser("eve");
      const { core } = visit(world, "/sign-in");
      await signIn(core, credentials);

      await core.members.load(stranger.organization.id);

      expect(core.getState().members).toEqual([]);
      expect(core.getState().error?.code).toBe("FORBIDDEN");
    },
  );
});

/** The signed-in user's id, which is what a membership is keyed by. */
function signedInId(core: AppCore): string | null {
  const { auth } = core.getState();
  return auth.status === "authenticated" ? auth.user.id : null;
}
