import type { AppActionContext } from "./context.js";
import type { ConnectionDraft } from "./state.js";

/**
 * Where this organization's repositories come from. Connecting is a deliberate
 * act, separate from signing in: the connection belongs to the organization,
 * not to the person, so it outlives whoever set it up.
 */
export function createConnectionActions({
  client,
  store,
  attempt,
}: AppActionContext) {
  return {
    load: (organizationId: string) =>
      attempt(() => client.connections.load(organizationId)),
    changeDraft: (draft: Partial<ConnectionDraft>) => {
      store.dispatch({ type: "connection-draft-changed", draft });
    },
    /**
     * Connects the folder on this machine that holds the user's repositories.
     * Succeeding means the repositories are readable now, so the list is
     * re-read in the same action rather than on the next page visit.
     */
    connectLocal: (organizationId: string) =>
      attempt(async () => {
        const rootPath = store.getState().connectionDraft.rootPath.trim();
        if (!rootPath) return;
        await client.connections.connect(organizationId, {
          provider: "local",
          config: { rootPath },
        });
        store.dispatch({
          type: "connection-draft-changed",
          draft: { rootPath: "" },
        });
        await client.repositories.load(organizationId);
      }),
    disconnect: (organizationId: string, connectionId: string) =>
      attempt(() =>
        client.connections.disconnect(organizationId, connectionId),
      ),
  };
}
