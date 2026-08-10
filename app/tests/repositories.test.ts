import { describe } from "vitest";

import { it } from "../../domain-client/tests/kit/fixtures.js";
import type { World } from "../../domain-client/tests/kit/world.js";
import { currentWorkspace } from "../client/index.js";
import type { AppCore } from "../client/index.js";

import { signIn, visit } from "./harness.js";

/** A signed-in founder whose organization already holds the named repositories. */
async function withRepositories(world: World, names: string[]) {
  const founder = await world.founder("ada");
  const organizationId = founder.organization.id;
  for (const name of names)
    await founder.core.sources.create(organizationId, {
      name,
      kind: "git",
      config: { remote: `git@github.com:ada/${name}.git` },
    });
  const { core, history } = visit(world, "/sign-in");
  await signIn(core, founder.credentials);
  return { core, history, organizationId };
}

/** Creates a workspace through the page's own form and returns it. */
async function createWorkspace(
  core: AppCore,
  organizationId: string,
  name: string,
) {
  core.workspaces.changeDraft({ name });
  await core.workspaces.create(organizationId);
  const workspace = core
    .getState()
    .workspaces.find((candidate) => candidate.name === name);
  if (!workspace) throw new Error(`the workspace ${name} was not created`);
  return workspace;
}

describe("choosing the repositories a workspace works on", () => {
  it.concurrent(
    "opening a workspace moves the URL and names the page",
    async ({ world, expect }) => {
      const { core, history, organizationId } = await withRepositories(
        world,
        [],
      );
      const workspace = await createWorkspace(
        core,
        organizationId,
        "Reporting",
      );

      core.workspaces.open(organizationId, workspace.id);

      expect(history.path()).toBe(
        `/app/organizations/${organizationId}/workspaces/${workspace.id}`,
      );
      expect(currentWorkspace(core.getState())?.name).toBe("Reporting");
    },
  );

  it.concurrent(
    "a repository is added to the workspace and removed again",
    async ({ world, expect }) => {
      const { core, organizationId } = await withRepositories(world, [
        "engine",
        "notes",
      ]);
      const workspace = await createWorkspace(
        core,
        organizationId,
        "Reporting",
      );
      core.workspaces.open(organizationId, workspace.id);
      await core.repositories.load(organizationId);

      const engine = core
        .getState()
        .sources.find((source) => source.name === "engine");
      if (!engine) throw new Error("the repository was not seeded");

      await core.repositories.attach(organizationId, workspace.id, engine.id);

      expect(currentWorkspace(core.getState())?.sourceIds).toEqual([engine.id]);

      await core.repositories.detach(organizationId, workspace.id, engine.id);

      expect(currentWorkspace(core.getState())?.sourceIds).toEqual([]);
      expect(core.getState().error).toBeNull();
    },
  );

  it.concurrent(
    "adding the same repository twice leaves one copy",
    async ({ world, expect }) => {
      const { core, organizationId } = await withRepositories(world, [
        "engine",
      ]);
      const workspace = await createWorkspace(
        core,
        organizationId,
        "Reporting",
      );
      core.workspaces.open(organizationId, workspace.id);
      await core.repositories.load(organizationId);
      const [engine] = core.getState().sources;
      if (!engine) throw new Error("the repository was not seeded");

      await core.repositories.attach(organizationId, workspace.id, engine.id);
      await core.repositories.attach(organizationId, workspace.id, engine.id);

      expect(currentWorkspace(core.getState())?.sourceIds).toEqual([engine.id]);
      expect(core.getState().error).toBeNull();
    },
  );

  it.concurrent(
    "another organization's repositories are a failure the page can show",
    async ({ world, expect }) => {
      const stranger = await world.founder("ada");
      const { credentials } = await world.signedUpUser("eve");
      const { core } = visit(world, "/sign-in");
      await signIn(core, credentials);

      await core.repositories.load(stranger.organization.id);

      expect(core.getState().sources).toEqual([]);
      expect(core.getState().error?.code).toBe("FORBIDDEN");
    },
  );
});
