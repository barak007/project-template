import type { AppActionContext } from "./context.js";
import { createDraftForm } from "./draft-form.js";
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
  const form = createDraftForm(store, {
    form: "workspace",
    changed: (draft: Partial<NameDraft>) => ({
      type: "workspace-draft-changed",
      draft,
    }),
    empty: { name: "" },
  });

  return {
    load: (organizationId: string) =>
      attempt(() => client.workspaces.load(organizationId), {
        loaded: loadKeys.workspaces(organizationId),
      }),
    open: (organizationId: string, workspaceId: string) => {
      navigation.navigate({ kind: "workspace", organizationId, workspaceId });
    },
    changeDraft: form.change,
    startCreating: form.open,
    cancelCreating: form.cancel,
    create: (organizationId: string) =>
      attempt(
        async () => {
          const name = store.getState().workspaceDraft.name.trim();
          if (!name) return;
          await client.workspaces.create(organizationId, { name });
          form.finish();
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
