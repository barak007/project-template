import type { ProjectTarget } from "../../domain-client/index.js";

import type { AppActionContext } from "./context.js";

/**
 * The file tree and the open file of one git project — a workspace's own project
 * or a session's clone of it. Both pages are the same two panes over the same
 * actions, which is why the target is an argument rather than two namespaces.
 *
 * Expanding is a toggle rather than two actions, because a folder in a tree is
 * one control; which of the two it does is state, so the decision belongs here
 * and not in a component.
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
    openRoot: (organizationId: string, target: ProjectTarget) =>
      attempt(() => client.projectFiles.openDirectory(organizationId, target)),
    toggleDirectory: (
      organizationId: string,
      target: ProjectTarget,
      path: string,
    ) =>
      attempt(async () => {
        const current = store.getState().projectFiles;
        const open =
          current.target?.kind === target.kind &&
          current.target.id === target.id &&
          path in current.directories;
        if (open) client.projectFiles.collapseDirectory(path);
        else
          await client.projectFiles.openDirectory(organizationId, target, path);
      }),
    openFile: (organizationId: string, target: ProjectTarget, path: string) =>
      attempt(() => client.projectFiles.openFile(organizationId, target, path)),
  };
}
