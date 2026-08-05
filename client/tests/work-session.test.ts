import { describe } from "vitest";

import { it } from "./kit/fixtures.js";

describe("work session stories", () => {
  it.concurrent(
    "starting a session snapshots sources and merged values, user values winning",
    async ({ world, expect }) => {
      const { core, organization } = await world.founder("ada");

      await core.sources.create(organization.id, {
        name: "repo",
        kind: "git",
        config: { url: "git://example.test/repo" },
      });
      const source = core.getState().sources[0];
      if (!source) throw new Error("Source was not created");
      await core.workspaces.create(organization.id, {
        name: "main",
        sourceIds: [source.id],
      });
      const workspace = core.getState().workspaces[0];
      if (!workspace) throw new Error("Workspace was not created");

      await core.organizationData.put(organization.id, {
        key: "region",
        value: "eu",
      });
      await core.organizationData.put(organization.id, {
        key: "quota",
        value: 10,
      });
      await core.userData.put({ key: "region", value: "us" });
      await core.organizationSecrets.put(organization.id, {
        key: "ORG_TOKEN",
        value: "org-secret-value",
      });
      await core.userSecrets.put({
        key: "MY_TOKEN",
        value: "user-secret-value",
      });

      await core.workSessions.start(organization.id, workspace.id);
      const session = core.getState().workSessions[0];
      expect(session).toMatchObject({
        status: "pending",
        workspaceId: workspace.id,
        dataSnapshot: { region: "us", quota: 10 },
        secretKeys: ["MY_TOKEN", "ORG_TOKEN"],
      });
      expect(session?.sourcesSnapshot.map(({ name }) => name)).toEqual([
        "repo",
      ]);
      if (!session) return;

      await core.workSessions.refresh(organization.id, session.id);
      expect(core.getState().workSessions).toHaveLength(1);

      await core.workSessions.load(organization.id);
      expect(core.getState().workSessions).toHaveLength(1);
    },
  );
});
