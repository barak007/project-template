import type { AppActionContext } from "./context.js";
import { requiresAuthentication } from "./router.js";
import { emptySignInDraft, emptySignUpDraft } from "./state.js";
import type { CredentialsDraft, SignUpDraft } from "./state.js";

/**
 * Signing in and out, plus the drafts of the two forms that do it. The client
 * core owns the credentials exchange; this namespace owns what the visitor
 * typed and where they end up.
 */
export function createSessionActions({
  client,
  store,
  navigation,
  attempt,
}: AppActionContext) {
  const authenticated = () => store.getState().auth.status === "authenticated";

  /**
   * Deep links survive the login: a visitor who was sent to the sign-in page
   * from /app/organizations/x stays on that route, so only a visitor who
   * signed in from a public page is moved to the dashboard.
   */
  const enterApp = () => {
    if (!requiresAuthentication(store.getState().route))
      navigation.navigate({ kind: "dashboard" });
  };

  return {
    /** Boot: resolve the session cookie into an identity before rendering a page. */
    load: () =>
      attempt(async () => {
        await client.auth.loadSession();
        store.dispatch({ type: "session-resolved" });
      }),
    changeSignInDraft: (draft: Partial<CredentialsDraft>) => {
      store.dispatch({ type: "sign-in-draft-changed", draft });
    },
    changeSignUpDraft: (draft: Partial<SignUpDraft>) => {
      store.dispatch({ type: "sign-up-draft-changed", draft });
    },
    // A rejected credential is state on `auth.error`, not a failure of the
    // action — so success is read off the store rather than caught.
    signIn: () =>
      attempt(async () => {
        await client.auth.signIn(store.getState().signInDraft);
        if (!authenticated()) return;
        store.dispatch({
          type: "sign-in-draft-changed",
          draft: emptySignInDraft,
        });
        enterApp();
      }),
    signUp: () =>
      attempt(async () => {
        await client.auth.signUp(store.getState().signUpDraft);
        if (!authenticated()) return;
        store.dispatch({
          type: "sign-up-draft-changed",
          draft: emptySignUpDraft,
        });
        enterApp();
      }),
    signOut: () =>
      attempt(async () => {
        await client.auth.signOut();
        navigation.navigate({ kind: "home" });
      }),
  };
}
