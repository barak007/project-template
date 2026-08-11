import { describe } from "vitest";

import { it } from "./kit/fixtures.js";

/**
 * Browsing what a session holds. The kit runs no worker, so a session here
 * never gets a project — which is exactly the case a page has to survive. That
 * a ready project is read correctly (and that a path cannot climb out of it) is
 * [work-session-files.test.ts](../../domain-server/tests/work-session-files.test.ts).
 */
describe("session file stories", () => {
  it.concurrent(
    "a session with no project yet cannot be browsed, and nothing is invented",
    async ({ world, expect }) => {
      const { core, organization } = await world.founder("ada");
      await core.sources.create(organization.id, {
        name: "engine",
        kind: "git",
        config: { remote: "git://example.test/engine" },
      });
      const source = core.getState().sources[0];
      if (!source) throw new Error("Source was not created");
      await core.workspaces.create(organization.id, {
        name: "main",
        sourceIds: [source.id],
      });
      const workspace = core.getState().workspaces[0];
      if (!workspace) throw new Error("Workspace was not created");
      await core.workSessions.start(organization.id, workspace.id);
      const session = core.getState().workSessions[0];
      if (!session) throw new Error("Session was not created");

      await expect(
        core.sessionFiles.openDirectory(organization.id, session.id),
      ).rejects.toMatchObject({ name: "ApiError" });
      await expect(
        core.sessionFiles.openFile(organization.id, session.id, "README.md"),
      ).rejects.toMatchObject({ name: "ApiError" });

      expect(core.getState().sessionFiles).toEqual({
        workSessionId: null,
        directories: {},
        openFile: null,
      });
    },
  );

  it.concurrent(
    "a session of another organization is not readable",
    async ({ world, expect }) => {
      const ada = await world.founder("ada");
      const grace = await world.founder("grace");
      await grace.core.workspaces.create(grace.organization.id, {
        name: "theirs",
        sourceIds: [],
      });
      const workspace = grace.core.getState().workspaces[0];
      if (!workspace) throw new Error("Workspace was not created");
      await grace.core.workSessions.start(grace.organization.id, workspace.id);
      const session = grace.core.getState().workSessions[0];
      if (!session) throw new Error("Session was not created");

      await expect(
        ada.core.sessionFiles.openDirectory(ada.organization.id, session.id),
      ).rejects.toMatchObject({ name: "ApiError", code: "NOT_FOUND" });
    },
  );
});
