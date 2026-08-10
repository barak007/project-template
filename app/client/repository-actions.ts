import type { AppActionContext } from "./context.js";

/**
 * The repositories an organization can work on, and which of them a workspace
 * uses. "Repository" is the only word the product has for these: the server
 * stores them as git sources, and a work session snapshots that list — but a
 * user picking repositories for a workspace never meets the concept.
 */
export function createRepositoryActions({
  client,
  store,
  attempt,
}: AppActionContext) {
  /**
   * Attaching and detaching are both a full update of the workspace, so the
   * current name travels with the new list — the server takes a replacement,
   * not a patch.
   */
  const rewrite = (
    organizationId: string,
    workspaceId: string,
    change: (sourceIds: string[]) => string[],
  ) =>
    attempt(async () => {
      const workspace = store
        .getState()
        .workspaces.find((candidate) => candidate.id === workspaceId);
      if (!workspace) return;
      const sourceIds = change(workspace.sourceIds);
      if (sourceIds.length === workspace.sourceIds.length) return;
      await client.workspaces.update(organizationId, workspaceId, {
        name: workspace.name,
        sourceIds,
      });
    });

  return {
    load: (organizationId: string) =>
      attempt(() => client.sources.load(organizationId)),
    attach: (organizationId: string, workspaceId: string, sourceId: string) =>
      rewrite(organizationId, workspaceId, (sourceIds) =>
        sourceIds.includes(sourceId) ? sourceIds : [...sourceIds, sourceId],
      ),
    detach: (organizationId: string, workspaceId: string, sourceId: string) =>
      rewrite(organizationId, workspaceId, (sourceIds) =>
        sourceIds.filter((candidate) => candidate !== sourceId),
      ),
  };
}
