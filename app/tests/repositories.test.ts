import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe } from "vitest";

import { it } from "../../domain-client/tests/kit/fixtures.js";
import type { World } from "../../domain-client/tests/kit/world.js";
import { currentWorkspace } from "../client/index.js";
import type { AppCore } from "../client/index.js";

import { signIn, visit } from "./harness.js";

/**
 * A real folder holding real git repositories — the local provider reads the
 * filesystem, so a story about picking repositories is worth nothing against
 * a fake one.
 */
async function folderOfRepositories(
  names: string[],
  // The context's own hook, not the imported one: these stories run
  // concurrently, so cleanup has to be registered against this test.
  cleanUpAfterwards: (clean: () => Promise<void>) => void,
) {
  const root = await mkdtemp(join(tmpdir(), "wwsa-repos-"));
  cleanUpAfterwards(() => rm(root, { recursive: true, force: true }));
  for (const name of names)
    await mkdir(join(root, name, ".git"), { recursive: true });
  return root;
}

/** A signed-in founder whose organization is connected to `root`. */
async function connectedFounder(world: World, root: string) {
  const founder = await world.founder("ada");
  const organizationId = founder.organization.id;
  const { core, history } = visit(world, "/sign-in");
  await signIn(core, founder.credentials);
  core.connections.changeDraft({ rootPath: root });
  await core.connections.connectLocal(organizationId);
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
    "connecting a folder lists the repositories inside it",
    async ({ world, expect, onTestFinished }) => {
      const root = await folderOfRepositories(
        ["engine", "notes"],
        onTestFinished,
      );
      // A directory that is not a repository is not offered.
      await mkdir(join(root, "scratch"), { recursive: true });
      const { core } = await connectedFounder(world, root);

      expect(core.getState().repositories.map((one) => one.name)).toEqual([
        "engine",
        "notes",
      ]);
      expect(core.getState().connections[0]?.label).toBe(root);
    },
  );

  it.concurrent(
    "opening a workspace moves the URL and names the page",
    async ({ world, expect, onTestFinished }) => {
      const root = await folderOfRepositories([], onTestFinished);
      const { core, history, organizationId } = await connectedFounder(
        world,
        root,
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
    async ({ world, expect, onTestFinished }) => {
      const root = await folderOfRepositories(
        ["engine", "notes"],
        onTestFinished,
      );
      const { core, organizationId } = await connectedFounder(world, root);
      const workspace = await createWorkspace(
        core,
        organizationId,
        "Reporting",
      );
      core.workspaces.open(organizationId, workspace.id);
      const [engine] = core.getState().repositories;
      if (!engine) throw new Error("the folder exposed no repositories");

      await core.repositories.add(organizationId, workspace.id, engine);

      // Adding imports the repository as a source, and the workspace points at it.
      const source = core
        .getState()
        .sources.find((candidate) => candidate.name === "engine");
      if (!source) throw new Error("the repository was not imported");
      expect(currentWorkspace(core.getState())?.sourceIds).toEqual([source.id]);

      await core.repositories.remove(organizationId, workspace.id, source.id);

      expect(currentWorkspace(core.getState())?.sourceIds).toEqual([]);
      expect(core.getState().error).toBeNull();
    },
  );

  it.concurrent(
    "the same repository in two workspaces is imported once",
    async ({ world, expect, onTestFinished }) => {
      const root = await folderOfRepositories(["engine"], onTestFinished);
      const { core, organizationId } = await connectedFounder(world, root);
      const reporting = await createWorkspace(
        core,
        organizationId,
        "Reporting",
      );
      const billing = await createWorkspace(core, organizationId, "Billing");
      const [engine] = core.getState().repositories;
      if (!engine) throw new Error("the folder exposed no repositories");

      await core.repositories.add(organizationId, reporting.id, engine);
      await core.repositories.add(organizationId, billing.id, engine);

      const sources = core.getState().sources;
      expect(sources).toHaveLength(1);
      const workspaces = core.getState().workspaces;
      for (const workspace of workspaces)
        expect(workspace.sourceIds).toEqual([sources[0]?.id]);
      expect(core.getState().error).toBeNull();
    },
  );

  it.concurrent(
    "connecting a folder that does not exist is a failure the page can show",
    async ({ world, expect }) => {
      const founder = await world.founder("ada");
      const { core } = visit(world, "/sign-in");
      await signIn(core, founder.credentials);

      core.connections.changeDraft({ rootPath: "/no/such/folder/anywhere" });
      await core.connections.connectLocal(founder.organization.id);

      expect(core.getState().connections).toEqual([]);
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

      expect(core.getState().repositories).toEqual([]);
      expect(core.getState().error?.code).toBe("FORBIDDEN");
    },
  );

  it.concurrent(
    "disconnecting takes the repositories with it",
    async ({ world, expect, onTestFinished }) => {
      const root = await folderOfRepositories(["engine"], onTestFinished);
      const { core, organizationId } = await connectedFounder(world, root);
      const connection = core.getState().connections[0];
      if (!connection) throw new Error("the folder was not connected");

      await core.connections.disconnect(organizationId, connection.id);

      expect(core.getState().connections).toEqual([]);
      expect(core.getState().repositories).toEqual([]);
    },
  );
});
