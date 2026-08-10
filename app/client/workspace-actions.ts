import type { AppActionContext } from "./context.js";
import type { NameDraft } from "./state.js";

/**
 * The workspaces of one organization — the boilerplate's example of an
 * organization-scoped aggregate behind the login. Scope is explicit: every
 * action takes the organization it acts on, like the client core's.
 */
export function createWorkspaceActions({
  client,
  store,
  attempt,
}: AppActionContext) {
  return {
    load: (organizationId: string) =>
      attempt(() => client.workspaces.load(organizationId)),
    changeDraft: (draft: Partial<NameDraft>) => {
      store.dispatch({ type: "workspace-draft-changed", draft });
    },
    create: (organizationId: string) =>
      attempt(async () => {
        const name = store.getState().workspaceDraft.name.trim();
        if (!name) return;
        await client.workspaces.create(organizationId, { name });
        store.dispatch({
          type: "workspace-draft-changed",
          draft: { name: "" },
        });
      }),
    delete: (organizationId: string, workspaceId: string) =>
      attempt(() => client.workspaces.delete(organizationId, workspaceId)),
  };
}
