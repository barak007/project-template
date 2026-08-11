import { describe } from "vitest";

import { it } from "./kit/fixtures.js";

/**
 * Browsing a project — a workspace's own, or a session's clone of it. The kit
 * runs no worker, so nothing here ever gets a project built, which is exactly
 * the case a page has to survive. That a real project is read correctly (and
 * that a path cannot climb out of it) is
 * [project-files.test.ts](../../domain-server/tests/project-files.test.ts).
 */
describe("project file stories", () => {
  it.concurrent(
    "neither a workspace nor a session can be browsed before its project exists",
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
        core.projectFiles.openDirectory(organization.id, {
          kind: "session",
          id: session.id,
        }),
      ).rejects.toMatchObject({ name: "ApiError" });
      await expect(
        core.projectFiles.openFile(
          organization.id,
          { kind: "session", id: session.id },
          "README.md",
        ),
      ).rejects.toMatchObject({ name: "ApiError" });
      // The workspace's project is built by its first session, so it has none.
      await expect(
        core.projectFiles.openDirectory(organization.id, {
          kind: "workspace",
          id: workspace.id,
        }),
      ).rejects.toMatchObject({ name: "ApiError" });

      expect(core.getState().projectFiles).toEqual({
        target: null,
        directories: {},
        openFile: null,
      });
    },
  );

  it.concurrent(
    "a session or workspace of another organization is not readable",
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
        ada.core.projectFiles.openDirectory(ada.organization.id, {
          kind: "session",
          id: session.id,
        }),
      ).rejects.toMatchObject({ name: "ApiError", code: "NOT_FOUND" });
      await expect(
        ada.core.projectFiles.openDirectory(ada.organization.id, {
          kind: "workspace",
          id: workspace.id,
        }),
      ).rejects.toMatchObject({ name: "ApiError", code: "NOT_FOUND" });
    },
  );
});
