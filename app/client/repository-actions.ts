import type { AppActionContext } from "./context.js";

/**
 * The repositories a workspace works on. "Repository" is the only word the
 * product has for these: the server imports one as a git source and a work
 * session snapshots that list, but a user picking repositories never meets
 * the concept.
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
  const rewrite = async (
    organizationId: string,
    workspaceId: string,
    change: (sourceIds: string[]) => string[],
  ) => {
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
  };

  return {
    /**
     * Everything the workspace page shows: where repositories come from, what
     * those connections expose, and which of them are already imported.
     */
    load: (organizationId: string) =>
      attempt(async () => {
        await client.connections.load(organizationId);
        await client.sources.load(organizationId);
        await client.repositories.load(organizationId);
      }),
    /**
     * Importing is idempotent, so adding a repository a second workspace also
     * uses reuses the same source rather than duplicating it.
     */
    add: (
      organizationId: string,
      workspaceId: string,
      repository: { connectionId: string; externalId: string },
    ) =>
      attempt(async () => {
        const source = await client.repositories.importRepository(
          organizationId,
          repository,
        );
        await rewrite(organizationId, workspaceId, (sourceIds) =>
          sourceIds.includes(source.id) ? sourceIds : [...sourceIds, source.id],
        );
      }),
    remove: (organizationId: string, workspaceId: string, sourceId: string) =>
      attempt(() =>
        rewrite(organizationId, workspaceId, (sourceIds) =>
          sourceIds.filter((candidate) => candidate !== sourceId),
        ),
      ),
  };
}
