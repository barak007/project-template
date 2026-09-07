import type { AppActionContext } from "./context.js";
import { createDraftForm } from "./draft-form.js";
import { actionKeys, loadKeys } from "./keys.js";
import type { NameDraft } from "./state.js";

/** The organizations the signed-in user belongs to: the dashboard's subject. */
export function createOrganizationActions({
  client,
  store,
  navigation,
  attempt,
}: AppActionContext) {
  const form = createDraftForm(store, {
    form: "organization",
    changed: (draft: Partial<NameDraft>) => ({
      type: "organization-draft-changed",
      draft,
    }),
    empty: { name: "" },
  });

  return {
    load: () =>
      attempt(() => client.organizations.load(), {
        loaded: loadKeys.organizations,
      }),
    changeDraft: form.change,
    /** Opens the create form; the page shows it in place of its primary button. */
    startCreating: form.open,
    cancelCreating: form.cancel,
    create: () =>
      attempt(
        async () => {
          const name = store.getState().organizationDraft.name.trim();
          if (!name) return;
          await client.organizations.create({ name });
          // The form has done its job; leaving it open would put an empty input
          // above the thing that was just created.
          form.finish();
        },
        { key: actionKeys.createOrganization },
      ),
    open: (organizationId: string) => {
      navigation.navigate({ kind: "organization", organizationId });
    },
  };
}
