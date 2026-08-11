import { describe } from "vitest";

import { it } from "./kit/fixtures.js";

describe("workspace stories", () => {
  it.concurrent(
    "a founder shapes a workspace around sources",
    async ({ world, expect }) => {
      const { core, organization } = await world.founder("ada");

      await core.sources.create(organization.id, {
        name: "repo",
        kind: "git",
        config: { remote: "https://example.test/repo.git" },
      });
      await core.sources.create(organization.id, {
        name: "warehouse",
        kind: "database",
        config: {},
      });
      const [repo, warehouse] = core.getState().sources;
      expect(repo).toBeDefined();
      expect(warehouse).toBeDefined();
      if (!repo || !warehouse) return;

      await core.workspaces.create(organization.id, {
        name: "main",
        sourceIds: [repo.id],
      });
      const workspace = core.getState().workspaces[0];
      expect(workspace).toMatchObject({ name: "main", sourceIds: [repo.id] });
      if (!workspace) return;

      await core.workspaces.update(organization.id, workspace.id, {
        name: "everything",
        sourceIds: [repo.id, warehouse.id],
      });
      expect(core.getState().workspaces[0]).toMatchObject({
        name: "everything",
        sourceIds: [repo.id, warehouse.id],
      });

      await core.workspaces.load(organization.id);
      expect(core.getState().workspaces.map(({ name }) => name)).toEqual([
        "everything",
        organization.name,
      ]);

      await core.workspaces.delete(organization.id, workspace.id);
      expect(core.getState().workspaces.map(({ name }) => name)).toEqual([
        organization.name,
      ]);
    },
  );

  it.concurrent(
    "a new organization already has a workspace named after it",
    async ({ world, expect }) => {
      const { core, organization } = await world.founder("ada");

      await core.workspaces.load(organization.id);
      expect(core.getState().workspaces).toMatchObject([
        { name: organization.name, sourceIds: [] },
      ]);
    },
  );
});
