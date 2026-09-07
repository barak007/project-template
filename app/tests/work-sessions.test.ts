import { describe } from "vitest";

import { it } from "../../domain-client/tests/kit/fixtures.js";

import { signIn, visit } from "./harness.js";

/**
 * Creating a session from a workspace. The project is built by a worker, which
 * the kit does not run, so these stories end at a session the page shows as
 * preparing — that the project itself is correct is
 * [local-project-builder.test.ts](../../domain-server/tests/local-project-builder.test.ts).
 */
describe("creating a session from a workspace", () => {
  it.concurrent(
    "pressing create leaves a session the page can show as preparing",
    async ({ world, expect }) => {
      const founder = await world.founder("ada");
      const organizationId = founder.organization.id;
      const { core } = visit(world, "/sign-in");
      await signIn(core, founder.credentials);
      core.workspaces.changeDraft({ name: "Platform" });
      await core.workspaces.create(organizationId);
      const workspace = core.getState().workspaces[0];
      if (!workspace) throw new Error("the workspace was not created");
      core.workspaces.open(organizationId, workspace.id);
      core.repositories.draft("https://github.com/acme/engine.git");
      await core.repositories.add(organizationId, workspace.id);

      await core.workSessions.create(organizationId, workspace.id);

      const session = core.getState().workSessions[0];
      expect(session).toMatchObject({
        status: "pending",
        workspaceId: workspace.id,
        // Nothing is built yet, so there is nowhere to open.
        projectLocation: null,
        projectBranch: null,
      });
      // The workspace's repositories are what the session froze.
      expect(session?.sourcesSnapshot.map(({ name }) => name)).toEqual([
        "engine",
      ]);
      expect(core.getState().error).toBeNull();
    },
  );

  it.concurrent(
    "a session cannot be branched before its project exists",
    async ({ world, expect }) => {
      const founder = await world.founder("ada");
      const organizationId = founder.organization.id;
      const { core } = visit(world, "/sign-in");
      await signIn(core, founder.credentials);
      core.workspaces.changeDraft({ name: "Platform" });
      await core.workspaces.create(organizationId);
      const workspace = core.getState().workspaces[0];
      if (!workspace) throw new Error("the workspace was not created");
      core.repositories.draft("https://github.com/acme/engine.git");
      await core.repositories.add(organizationId, workspace.id);
      await core.workSessions.create(organizationId, workspace.id);
      const session = core.getState().workSessions[0];
      if (!session) throw new Error("the session was not created");

      await core.workSessions.branchAll(
        organizationId,
        session.id,
        "feature/login",
      );

      // A failure the page can show, not a throw past the action.
      expect(core.getState().error?.code).toBe("VALIDATION_FAILED");
    },
  );

  it.concurrent(
    "refreshing pending sessions is safe when there are none",
    async ({ world, expect }) => {
      const founder = await world.founder("ada");
      const { core } = visit(world, "/sign-in");
      await signIn(core, founder.credentials);

      await core.workSessions.refreshPending(founder.organization.id);

      expect(core.getState().workSessions).toEqual([]);
      expect(core.getState().error).toBeNull();
    },
  );
});
