import type { AppActionContext } from "./context.js";
import type { NameDraft } from "./state.js";

/** The organizations the signed-in user belongs to: the dashboard's subject. */
export function createOrganizationActions({
  client,
  store,
  navigation,
  attempt,
}: AppActionContext) {
  return {
    load: () => attempt(() => client.organizations.load()),
    changeDraft: (draft: Partial<NameDraft>) => {
      store.dispatch({ type: "organization-draft-changed", draft });
    },
    create: () =>
      attempt(async () => {
        const name = store.getState().organizationDraft.name.trim();
        if (!name) return;
        await client.organizations.create({ name });
        store.dispatch({
          type: "organization-draft-changed",
          draft: { name: "" },
        });
      }),
    open: (organizationId: string) => {
      navigation.navigate({ kind: "organization", organizationId });
    },
  };
}
