import { describe } from "vitest";

import { it } from "./kit/fixtures.js";

describe("source stories", () => {
  it.concurrent(
    "a founder manages sources end to end",
    async ({ world, expect }) => {
      const { core, organization } = await world.founder("ada");

      await core.sources.create(organization.id, {
        name: "repo",
        kind: "git",
        config: { url: "git://example.test/repo" },
      });
      const source = core.getState().sources[0];
      expect(source).toMatchObject({
        name: "repo",
        kind: "git",
        organizationId: organization.id,
      });
      if (!source) return;

      await core.sources.update(organization.id, source.id, {
        name: "monorepo",
        kind: "git",
        config: { url: "git://example.test/monorepo" },
      });
      expect(core.getState().sources.map(({ name }) => name)).toEqual([
        "monorepo",
      ]);

      await core.sources.load(organization.id);
      expect(core.getState().sources).toHaveLength(1);

      await core.sources.delete(organization.id, source.id);
      expect(core.getState().sources).toHaveLength(0);
    },
  );

  it.concurrent(
    "state follows the organization being worked on",
    async ({ world, expect }) => {
      const { core, organization: first } = await world.founder("ada");
      await core.organizations.create({ name: "Second Venture" });
      const second = core
        .getState()
        .organizations.find(({ id }) => id !== first.id);
      expect(second).toBeDefined();
      if (!second) return;

      await core.sources.create(first.id, {
        name: "repo",
        kind: "git",
        config: {},
      });
      expect(core.getState().currentOrganizationId).toBe(first.id);
      expect(core.getState().sources).toHaveLength(1);

      await core.sources.load(second.id);
      expect(core.getState().currentOrganizationId).toBe(second.id);
      expect(core.getState().sources).toHaveLength(0);
    },
  );
});
