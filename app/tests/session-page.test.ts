import { describe } from "vitest";

import { it } from "../../domain-client/tests/kit/fixtures.js";
import { visibleRoute } from "../client/index.js";

import { signIn, visit } from "./harness.js";

/**
 * Opening a session: the editor page over the files the session holds. The kit
 * runs no worker, so these stories end where the project would begin — a
 * session the page can only report as preparing, and reads that fail as state
 * rather than as a throw.
 */
describe("opening a session", () => {
  it.concurrent(
    "a session URL is a page of its own, kept across signing in",
    async ({ world, expect }) => {
      const founder = await world.founder("ada");
      const path = `/app/organizations/${founder.organization.id}/workspaces/ws-1/sessions/session-1`;
      const { core } = visit(world, path);

      // Behind the login, so an anonymous visitor is shown the form while the
      // URL keeps pointing at the session.
      expect(visibleRoute(core.getState())).toEqual({ kind: "sign-in" });

      await signIn(core, founder.credentials);

      expect(visibleRoute(core.getState())).toEqual({
        kind: "session",
        organizationId: founder.organization.id,
        workspaceId: "ws-1",
        workSessionId: "session-1",
      });
    },
  );

  it.concurrent(
    "browsing a session that is still being prepared fails into state",
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

      core.navigation.navigate({
        kind: "session",
        organizationId,
        workspaceId: workspace.id,
        workSessionId: session.id,
      });
      await core.projectFiles.openRoot(organizationId, session.id);

      expect(core.getState().error?.code).toBe("VALIDATION_FAILED");
      expect(core.getState().sessionFiles.directories).toEqual({});

      // Same for a folder and a file: a page never sees a throw.
      await core.projectFiles.toggleDirectory(
        organizationId,
        session.id,
        "engine",
      );
      expect(core.getState().error?.code).toBe("VALIDATION_FAILED");
      await core.projectFiles.openFile(
        organizationId,
        session.id,
        "engine/README.md",
      );
      expect(core.getState().error?.code).toBe("VALIDATION_FAILED");
      expect(core.getState().sessionFiles.openFile).toBeNull();
    },
  );
});
