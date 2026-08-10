import type { ClientState } from "../../domain-client/index.js";

import { defaultRoute } from "./router.js";
import type { Route } from "./router.js";

export type CredentialsDraft = { email: string; password: string };
export type SignUpDraft = CredentialsDraft & { name: string };
export type NameDraft = { name: string };
export type ConnectionDraft = { rootPath: string };
export type AppError = { code: string; message: string };

/**
 * What the app owns on top of the client core's state: where the user is,
 * what they have typed, and what went wrong. Drafts live here — no component
 * holds state of its own, so every flow is testable without rendering.
 */
export type AppOwnState = {
  route: Route;
  /**
   * False until the session cookie has been resolved into an identity; the
   * UI waits rather than flashing the wrong page.
   */
  sessionResolved: boolean;
  signInDraft: CredentialsDraft;
  signUpDraft: SignUpDraft;
  organizationDraft: NameDraft;
  workspaceDraft: NameDraft;
  connectionDraft: ConnectionDraft;
  /** The last failed action, cleared when the next one starts. */
  error: AppError | null;
};

export type AppState = ClientState & AppOwnState;

export const emptySignInDraft: CredentialsDraft = { email: "", password: "" };
export const emptySignUpDraft: SignUpDraft = {
  name: "",
  email: "",
  password: "",
};

export const initialAppOwnState: AppOwnState = {
  route: defaultRoute,
  sessionResolved: false,
  signInDraft: emptySignInDraft,
  signUpDraft: emptySignUpDraft,
  organizationDraft: { name: "" },
  workspaceDraft: { name: "" },
  connectionDraft: { rootPath: "" },
  error: null,
};
