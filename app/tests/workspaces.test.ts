import { describe } from "vitest";

import { it } from "../../domain-client/tests/kit/fixtures.js";
import { currentOrganization } from "../client/index.js";

import { signIn, visit } from "./harness.js";

describe("working inside the app", () => {
  it.concurrent(
    "a new user creates their first organization from the dashboard",
    async ({ world, expect }) => {
      const { credentials } = await world.signedUpUser("ada");
      const { core } = visit(world, "/sign-in");
      await signIn(core, credentials);

      core.organizations.changeDraft({ name: "Analytical Engines" });
      await core.organizations.create();

      const state = core.getState();
      expect(state.organizations.map((one) => one.name)).toEqual([
        "Analytical Engines",
      ]);
      // The form is empty again, ready for the next one.
      expect(state.organizationDraft).toEqual({ name: "" });
    },
  );

  it.concurrent(
    "opening an organization moves the URL and names the page",
    async ({ world, expect }) => {
      const founder = await world.founder("ada");
      const { core, history } = visit(world, "/sign-in");
      await signIn(core, founder.credentials);
      await core.organizations.load();

      core.organizations.open(founder.organization.id);

      expect(history.path()).toBe(
        `/app/organizations/${founder.organization.id}`,
      );
      expect(currentOrganization(core.getState())?.name).toBe(
        founder.organization.name,
      );
    },
  );

  it.concurrent(
    "workspaces are created and deleted inside the organization",
    async ({ world, expect }) => {
      const founder = await world.founder("ada");
      const { core } = visit(world, "/sign-in");
      await signIn(core, founder.credentials);
      const organizationId = founder.organization.id;

      core.workspaces.changeDraft({ name: "Reporting" });
      await core.workspaces.create(organizationId);

      expect(core.getState().workspaces.map((one) => one.name)).toEqual([
        "Reporting",
      ]);
      expect(core.getState().workspaceDraft).toEqual({ name: "" });

      const [workspace] = core.getState().workspaces;
      if (!workspace) throw new Error("the workspace was not created");
      await core.workspaces.delete(organizationId, workspace.id);

      expect(core.getState().workspaces).toEqual([]);
    },
  );

  it.concurrent("a blank name is not submitted", async ({ world, expect }) => {
    const founder = await world.founder("ada");
    const { core } = visit(world, "/sign-in");
    await signIn(core, founder.credentials);

    core.workspaces.changeDraft({ name: "   " });
    await core.workspaces.create(founder.organization.id);

    expect(core.getState().workspaces).toEqual([]);
    expect(core.getState().error).toBeNull();
  });

  it.concurrent(
    "another organization's data is a failure the page can show",
    async ({ world, expect }) => {
      const stranger = await world.founder("ada");
      const { credentials } = await world.signedUpUser("eve");
      const { core } = visit(world, "/sign-in");
      await signIn(core, credentials);

      await core.workspaces.load(stranger.organization.id);

      const { error, workspaces } = core.getState();
      expect(workspaces).toEqual([]);
      expect(error?.code).toBe("FORBIDDEN");
      expect(error?.message).toBeTruthy();
    },
  );

  it.concurrent(
    "moving to another page clears the failure it showed",
    async ({ world, expect }) => {
      const stranger = await world.founder("ada");
      const { credentials } = await world.signedUpUser("eve");
      const { core } = visit(world, "/sign-in");
      await signIn(core, credentials);
      await core.workspaces.load(stranger.organization.id);
      expect(core.getState().error).not.toBeNull();

      core.navigation.navigate({ kind: "dashboard" });

      expect(core.getState().error).toBeNull();
    },
  );
});
