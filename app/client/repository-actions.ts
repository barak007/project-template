import type { AppActionContext } from "./context.js";
import { actionKeys, loadKeys } from "./keys.js";

/**
 * The repositories a workspace works on. "Repository" is the only word the
 * product has for these: the server stores one as a git source and a work
 * session snapshots that list, but a user adding repositories never meets the
 * concept.
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
    /** Every repository the organization has defined, attached or not. */
    load: (organizationId: string) =>
      attempt(() => client.sources.load(organizationId), {
        loaded: loadKeys.repositories(organizationId),
      }),
    draft: (remote: string) => {
      store.dispatch({ type: "repository-draft-changed", remote });
    },
    startAdding: () => {
      store.dispatch({ type: "create-form-opened", form: "repository" });
    },
    cancelAdding: () => {
      store.dispatch({ type: "create-form-closed" });
      store.dispatch({ type: "repository-draft-changed", remote: "" });
    },
    /**
     * Defines the repository if it is new and attaches it to the workspace.
     * Adding a URL the organization already has reuses that repository rather
     * than duplicating it, which is what makes this safe to press twice.
     */
    add: (organizationId: string, workspaceId: string) =>
      attempt(
        async () => {
          const remote = store.getState().repositoryDraft.trim();
          if (remote.length === 0) return;
          const source = await client.repositories.add(organizationId, {
            remote,
          });
          await rewrite(organizationId, workspaceId, (sourceIds) =>
            sourceIds.includes(source.id)
              ? sourceIds
              : [...sourceIds, source.id],
          );
          store.dispatch({ type: "repository-draft-changed", remote: "" });
          store.dispatch({ type: "create-form-closed" });
        },
        { key: actionKeys.addRepository },
      ),
    remove: (organizationId: string, workspaceId: string, sourceId: string) =>
      attempt(
        () =>
          rewrite(organizationId, workspaceId, (sourceIds) =>
            sourceIds.filter((candidate) => candidate !== sourceId),
          ),
        { key: actionKeys.removeRepository(sourceId) },
      ),
  };
}
