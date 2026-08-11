import type { AppActionContext } from "./context.js";
import { actionKeys, loadKeys } from "./keys.js";
import type { NameDraft } from "./state.js";

/**
 * The workspaces of one organization — the boilerplate's example of an
 * organization-scoped aggregate behind the login. Scope is explicit: every
 * action takes the organization it acts on, like the client core's.
 */
export function createWorkspaceActions({
  client,
  store,
  navigation,
  attempt,
}: AppActionContext) {
  return {
    load: (organizationId: string) =>
      attempt(() => client.workspaces.load(organizationId), {
        loaded: loadKeys.workspaces(organizationId),
      }),
    open: (organizationId: string, workspaceId: string) => {
      navigation.navigate({ kind: "workspace", organizationId, workspaceId });
    },
    changeDraft: (draft: Partial<NameDraft>) => {
      store.dispatch({ type: "workspace-draft-changed", draft });
    },
    startCreating: () => {
      store.dispatch({ type: "create-form-opened", form: "workspace" });
    },
    cancelCreating: () => {
      store.dispatch({ type: "create-form-closed" });
      store.dispatch({ type: "workspace-draft-changed", draft: { name: "" } });
    },
    create: (organizationId: string) =>
      attempt(
        async () => {
          const name = store.getState().workspaceDraft.name.trim();
          if (!name) return;
          await client.workspaces.create(organizationId, { name });
          store.dispatch({
            type: "workspace-draft-changed",
            draft: { name: "" },
          });
          store.dispatch({ type: "create-form-closed" });
        },
        { key: actionKeys.createWorkspace },
      ),
    /**
     * Deleting takes the workspace's sessions with it, so the page arms the row
     * first (`confirmation.ask`) and this only runs on the second press.
     */
    delete: (organizationId: string, workspaceId: string) =>
      attempt(() => client.workspaces.delete(organizationId, workspaceId), {
        key: actionKeys.deleteWorkspace(workspaceId),
      }),
  };
}
