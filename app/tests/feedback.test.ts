import { describe } from "vitest";

import { it } from "../../domain-client/tests/kit/fixtures.js";
import {
  actionKeys,
  confirmKeys,
  hasLoaded,
  isConfirming,
  isPending,
  loadKeys,
} from "../client/index.js";

import { signIn, visit } from "./harness.js";

/**
 * What the pages say while they are working, and what they refuse to do without
 * being asked twice. All of it is state, so it is a story here rather than
 * something only a browser could show: an empty list is not the same as a list
 * nobody has read yet, a button that has been pressed is not pressable again,
 * and nothing irreversible happens on one click.
 */
describe("what the app says about its own work", () => {
  it.concurrent(
    "a collection nobody has read yet is not an empty collection",
    async ({ world, expect }) => {
      const founder = await world.founder("ada");
      const { core } = visit(world, "/sign-in");
      await signIn(core, founder.credentials);
      const key = loadKeys.workspaces(founder.organization.id);

      // The list is empty and the organization has a workspace: without the
      // second fact the page would say "nothing here yet" and then contradict
      // itself a moment later.
      expect(core.getState().workspaces).toEqual([]);
      expect(hasLoaded(core.getState(), key)).toBe(false);

      await core.workspaces.load(founder.organization.id);

      expect(hasLoaded(core.getState(), key)).toBe(true);
      expect(core.getState().workspaces.length).toBeGreaterThan(0);
    },
  );

  it.concurrent(
    "a read that failed has still been read, so the page can say why",
    async ({ world, expect }) => {
      const stranger = await world.founder("ada");
      const { credentials } = await world.signedUpUser("eve");
      const { core } = visit(world, "/sign-in");
      await signIn(core, credentials);

      await core.workspaces.load(stranger.organization.id);

      expect(
        hasLoaded(
          core.getState(),
          loadKeys.workspaces(stranger.organization.id),
        ),
      ).toBe(true);
      expect(core.getState().error?.code).toBe("FORBIDDEN");
    },
  );

  it.concurrent(
    "a pressed button is pending until the server answers",
    async ({ world, expect }) => {
      const founder = await world.founder("ada");
      const { core } = visit(world, "/sign-in");
      await signIn(core, founder.credentials);
      core.workspaces.changeDraft({ name: "Reporting" });

      const creating = core.workspaces.create(founder.organization.id);
      expect(isPending(core.getState(), actionKeys.createWorkspace)).toBe(true);
      await creating;

      expect(isPending(core.getState(), actionKeys.createWorkspace)).toBe(
        false,
      );
      expect(core.getState().workspaces).toHaveLength(1);
    },
  );

  it.concurrent(
    "a failed action stops being pending too",
    async ({ world, expect }) => {
      const stranger = await world.founder("ada");
      const { credentials } = await world.signedUpUser("eve");
      const { core } = visit(world, "/sign-in");
      await signIn(core, credentials);
      core.workspaces.changeDraft({ name: "Reporting" });

      await core.workspaces.create(stranger.organization.id);

      // A button left spinning forever is worse than the failure it hides.
      expect(isPending(core.getState(), actionKeys.createWorkspace)).toBe(
        false,
      );
      expect(core.getState().error).not.toBeNull();
    },
  );

  it.concurrent(
    "one row is armed at a time, and anything else disarms it",
    async ({ world, expect }) => {
      const founder = await world.founder("ada");
      const { core } = visit(world, "/sign-in");
      await signIn(core, founder.credentials);
      const first = confirmKeys.deleteWorkspace("one");
      const second = confirmKeys.deleteWorkspace("two");

      core.confirmation.ask(first);
      expect(isConfirming(core.getState(), first)).toBe(true);

      core.confirmation.ask(second);
      expect(isConfirming(core.getState(), first)).toBe(false);
      expect(isConfirming(core.getState(), second)).toBe(true);

      core.navigation.navigate({ kind: "dashboard" });
      expect(core.getState().confirming).toBeNull();
    },
  );

  it.concurrent(
    "opening a create form arms nothing and closing it drops the draft",
    async ({ world, expect }) => {
      const founder = await world.founder("ada");
      const { core } = visit(world, "/sign-in");
      await signIn(core, founder.credentials);

      core.confirmation.ask(confirmKeys.deleteWorkspace("one"));
      core.workspaces.startCreating();
      expect(core.getState().openForm).toBe("workspace");
      expect(core.getState().confirming).toBeNull();

      core.workspaces.changeDraft({ name: "half typed" });
      core.workspaces.cancelCreating();

      expect(core.getState().openForm).toBeNull();
      expect(core.getState().workspaceDraft).toEqual({ name: "" });
    },
  );

  it.concurrent(
    "creating closes the form that made it",
    async ({ world, expect }) => {
      const founder = await world.founder("ada");
      const { core } = visit(world, "/sign-in");
      await signIn(core, founder.credentials);

      core.workspaces.startCreating();
      core.workspaces.changeDraft({ name: "Reporting" });
      await core.workspaces.create(founder.organization.id);

      // Leaving it open would put an empty field above the new row.
      expect(core.getState().openForm).toBeNull();
    },
  );

  it.concurrent(
    "polling does not clear the failure the user is reading",
    async ({ world, expect }) => {
      const founder = await world.founder("ada");
      const { credentials } = await world.signedUpUser("eve");
      const { core } = visit(world, "/sign-in");
      await signIn(core, credentials);
      await core.workspaces.load(founder.organization.id);
      const failure = core.getState().error;
      expect(failure).not.toBeNull();

      // The workspace page ticks this every 1.5s while a session is preparing.
      await core.workSessions.refreshPending(founder.organization.id);

      expect(core.getState().error).toEqual(failure);
    },
  );

  it.concurrent(
    "a read failure can be put away without doing something else",
    async ({ world, expect }) => {
      const stranger = await world.founder("ada");
      const { credentials } = await world.signedUpUser("eve");
      const { core } = visit(world, "/sign-in");
      await signIn(core, credentials);
      await core.workspaces.load(stranger.organization.id);
      expect(core.getState().error).not.toBeNull();

      core.notices.dismiss();

      expect(core.getState().error).toBeNull();
    },
  );
});
