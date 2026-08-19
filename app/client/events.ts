import type { Route } from "./router.js";
import type {
  AppError,
  CreateForm,
  CredentialsDraft,
  GrantDraft,
  InviteDraft,
  NameDraft,
  SignUpDraft,
} from "./state.js";

/**
 * Everything that can happen to the app's own slices, as facts. The client
 * core keeps its own events (domain-client/events.ts); this layer only adds
 * where the user is, what they typed, and what failed.
 */
export type AppEvent =
  | { type: "navigated"; route: Route }
  | { type: "session-resolved" }
  | { type: "sign-in-draft-changed"; draft: Partial<CredentialsDraft> }
  | { type: "sign-up-draft-changed"; draft: Partial<SignUpDraft> }
  | { type: "organization-draft-changed"; draft: Partial<NameDraft> }
  | { type: "workspace-draft-changed"; draft: Partial<NameDraft> }
  | { type: "repository-draft-changed"; remote: string }
  | { type: "invite-draft-changed"; draft: Partial<InviteDraft> }
  | { type: "grant-draft-changed"; draft: Partial<GrantDraft> }
  | { type: "create-form-opened"; form: CreateForm }
  | { type: "create-form-closed" }
  | { type: "confirmation-asked"; key: string }
  | { type: "confirmation-cancelled" }
  | { type: "error-dismissed" }
  | { type: "action-started"; key?: string }
  | { type: "action-finished"; key?: string; loaded?: string }
  | { type: "action-failed"; error: AppError; key?: string; loaded?: string };
