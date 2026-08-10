import type { Route } from "./router.js";
import type {
  AppError,
  ConnectionDraft,
  CredentialsDraft,
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
  | { type: "connection-draft-changed"; draft: Partial<ConnectionDraft> }
  | { type: "action-started" }
  | { type: "action-failed"; error: AppError };
