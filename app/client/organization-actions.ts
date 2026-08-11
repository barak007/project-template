import type { AppActionContext } from "./context.js";
import { actionKeys, loadKeys } from "./keys.js";
import type { NameDraft } from "./state.js";

/** The organizations the signed-in user belongs to: the dashboard's subject. */
export function createOrganizationActions({
  client,
  store,
  navigation,
  attempt,
}: AppActionContext) {
  return {
    load: () =>
      attempt(() => client.organizations.load(), {
        loaded: loadKeys.organizations,
      }),
    changeDraft: (draft: Partial<NameDraft>) => {
      store.dispatch({ type: "organization-draft-changed", draft });
    },
    /** Opens the create form; the page shows it in place of its primary button. */
    startCreating: () => {
      store.dispatch({ type: "create-form-opened", form: "organization" });
    },
    cancelCreating: () => {
      store.dispatch({ type: "create-form-closed" });
      store.dispatch({
        type: "organization-draft-changed",
        draft: { name: "" },
      });
    },
    create: () =>
      attempt(
        async () => {
          const name = store.getState().organizationDraft.name.trim();
          if (!name) return;
          await client.organizations.create({ name });
          store.dispatch({
            type: "organization-draft-changed",
            draft: { name: "" },
          });
          // The form has done its job; leaving it open would put an empty input
          // above the thing that was just created.
          store.dispatch({ type: "create-form-closed" });
        },
        { key: actionKeys.createOrganization },
      ),
    open: (organizationId: string) => {
      navigation.navigate({ kind: "organization", organizationId });
    },
  };
}
