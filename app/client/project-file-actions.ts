import type { AppActionContext } from "./context.js";

/**
 * The file tree and the open file of one work session's project — what the
 * session page is. Expanding is a toggle rather than two actions, because a
 * folder in a tree is one control; which of the two it does is state, so the
 * decision belongs here and not in a component.
 *
 * Everything is read through the API: nothing assumes the project is on the
 * machine the browser is running on.
 */
export function createProjectFileActions({
  client,
  store,
  attempt,
}: AppActionContext) {
  return {
    openRoot: (organizationId: string, workSessionId: string) =>
      attempt(() =>
        client.sessionFiles.openDirectory(organizationId, workSessionId),
      ),
    toggleDirectory: (
      organizationId: string,
      workSessionId: string,
      path: string,
    ) =>
      attempt(async () => {
        const { sessionFiles } = store.getState();
        const open =
          sessionFiles.workSessionId === workSessionId &&
          path in sessionFiles.directories;
        if (open) client.sessionFiles.collapseDirectory(path);
        else
          await client.sessionFiles.openDirectory(
            organizationId,
            workSessionId,
            path,
          );
      }),
    openFile: (organizationId: string, workSessionId: string, path: string) =>
      attempt(() =>
        client.sessionFiles.openFile(organizationId, workSessionId, path),
      ),
  };
}
