import { describe } from "vitest";

import { it } from "../../domain-client/tests/kit/fixtures.js";
import type { World } from "../../domain-client/tests/kit/world.js";
import { currentWorkspace } from "../client/index.js";
import type { AppCore } from "../client/index.js";

import { signIn, visit } from "./harness.js";

/** A signed-in founder, on the page a workspace is created from. */
async function founderAtWork(world: World) {
  const founder = await world.founder("ada");
  const { core, history } = visit(world, "/sign-in");
  await signIn(core, founder.credentials);
  return { core, history, organizationId: founder.organization.id };
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

/** Types a URL into the page's field and submits it. */
async function addRepository(
  core: AppCore,
  organizationId: string,
  workspaceId: string,
  remote: string,
) {
  core.repositories.draft(remote);
  await core.repositories.add(organizationId, workspaceId);
}

describe("choosing the repositories a workspace works on", () => {
  it.concurrent(
    "opening a workspace moves the URL and names the page",
    async ({ world, expect }) => {
      const { core, history, organizationId } = await founderAtWork(world);
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
    "a URL becomes a repository in the workspace, and is removed again",
    async ({ world, expect }) => {
      const { core, organizationId } = await founderAtWork(world);
      const workspace = await createWorkspace(
        core,
        organizationId,
        "Reporting",
      );
      core.workspaces.open(organizationId, workspace.id);

      await addRepository(
        core,
        organizationId,
        workspace.id,
        "https://github.com/acme/engine.git",
      );

      // The URL's last segment names it, and the field is cleared to type another.
      const source = core
        .getState()
        .sources.find((candidate) => candidate.name === "engine");
      if (!source) throw new Error("the repository was not added");
      expect(currentWorkspace(core.getState())?.sourceIds).toEqual([source.id]);
      expect(core.getState().repositoryDraft).toBe("");

      await core.repositories.remove(organizationId, workspace.id, source.id);

      expect(currentWorkspace(core.getState())?.sourceIds).toEqual([]);
      expect(core.getState().error).toBeNull();
    },
  );

  it.concurrent(
    "the same URL in two workspaces is one repository",
    async ({ world, expect }) => {
      const { core, organizationId } = await founderAtWork(world);
      const reporting = await createWorkspace(
        core,
        organizationId,
        "Reporting",
      );
      const billing = await createWorkspace(core, organizationId, "Billing");
      const remote = "git@github.com:acme/engine.git";

      await addRepository(core, organizationId, reporting.id, remote);
      await addRepository(core, organizationId, billing.id, remote);

      const sources = core.getState().sources;
      expect(sources).toHaveLength(1);
      for (const workspace of core.getState().workspaces)
        expect(workspace.sourceIds).toEqual([sources[0]?.id]);
      expect(core.getState().error).toBeNull();
    },
  );

  it.concurrent(
    "two repositories whose URLs end the same way both keep a name",
    async ({ world, expect }) => {
      const { core, organizationId } = await founderAtWork(world);
      const workspace = await createWorkspace(core, organizationId, "Platform");
      core.workspaces.open(organizationId, workspace.id);

      await addRepository(
        core,
        organizationId,
        workspace.id,
        "https://github.com/acme/api.git",
      );
      await addRepository(
        core,
        organizationId,
        workspace.id,
        "https://github.com/other/api.git",
      );

      expect(
        core
          .getState()
          .sources.map((one) => one.name)
          .sort(),
      ).toEqual(["api", "api-2"]);
      expect(currentWorkspace(core.getState())?.sourceIds).toHaveLength(2);
    },
  );

  it.concurrent(
    "something that is not a git URL is a failure the page can show",
    async ({ world, expect }) => {
      const { core, organizationId } = await founderAtWork(world);
      const workspace = await createWorkspace(core, organizationId, "Platform");

      await addRepository(
        core,
        organizationId,
        workspace.id,
        "/Users/ada/projects/engine",
      );

      expect(core.getState().sources).toEqual([]);
      expect(core.getState().error?.code).toBe("VALIDATION_FAILED");
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
