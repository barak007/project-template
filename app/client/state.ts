import type {
  ClientState,
  Membership,
  WorkspaceRole,
} from "../../domain-client/index.js";

import { defaultRoute } from "./router.js";
import type { Route } from "./router.js";

export type CredentialsDraft = { email: string; password: string };
export type SignUpDraft = CredentialsDraft & { name: string };
export type NameDraft = { name: string };
/** Who to invite, and as what. An invitation is addressed to an email. */
export type InviteDraft = { email: string; role: Membership["role"] };
/** Who to give access to one workspace, and how much. */
export type GrantDraft = { userId: string; role: WorkspaceRole };
export type AppError = { code: string; message: string };

/**
 * Which create form is expanded. Creating is a rare action, so its form is not
 * permanently on the page: it is either the whole of an empty list's empty
 * state, or one disclosure behind the page's primary button.
 */
export type CreateForm =
  | "organization"
  | "workspace"
  | "repository"
  | "invitation"
  | "grant";

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
  /** The repository URL being typed on the workspace page. */
  repositoryDraft: string;
  /** The address being invited on the organization page. */
  inviteDraft: InviteDraft;
  /** Who is being given access on the workspace page. */
  grantDraft: GrantDraft;
  /**
   * Which collections have finished loading at least once, by key. An empty
   * list and a list nobody has asked for are the same value — without this the
   * first paint of a full account says "nothing here yet".
   */
  loaded: readonly string[];
  /**
   * The actions in flight, by key. A button that has been pressed says so and
   * cannot be pressed again, which is what stops a double click creating two.
   */
  pending: readonly string[];
  /**
   * What a destructive button is waiting to be confirmed, by key. Deleting is
   * two presses rather than a dialog, so nothing leaves on one stray click.
   */
  confirming: string | null;
  /** The create form that has been opened, if any. */
  openForm: CreateForm | null;
  /** The last failed action, cleared when the next one starts. */
  error: AppError | null;
};

export type AppState = ClientState & AppOwnState;

export const emptySignInDraft: CredentialsDraft = { email: "", password: "" };
export const emptyInviteDraft: InviteDraft = { email: "", role: "member" };
export const emptyGrantDraft: GrantDraft = { userId: "", role: "viewer" };
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
  repositoryDraft: "",
  inviteDraft: emptyInviteDraft,
  grantDraft: emptyGrantDraft,
  loaded: [],
  pending: [],
  confirming: null,
  openForm: null,
  error: null,
};
