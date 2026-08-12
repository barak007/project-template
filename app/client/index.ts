import type { History } from "../../domain-client/history.js";
import { createClientCore } from "../../domain-client/index.js";
import type { Host } from "../../domain-client/index.js";

import { createAttempt } from "./attempt.js";
import { createConfirmationActions } from "./confirmation-actions.js";
import type { AppActionContext } from "./context.js";
import { createInboxActions } from "./inbox-actions.js";
import { createInvitationActions } from "./invitation-actions.js";
import { createMemberActions } from "./member-actions.js";
import { createAppNavigation } from "./navigation-actions.js";
import { createNoticeActions } from "./notice-actions.js";
import { createOrganizationActions } from "./organization-actions.js";
import { createProjectFileActions } from "./project-file-actions.js";
import { createRepositoryActions } from "./repository-actions.js";
import { createSessionActions } from "./session-actions.js";
import { createAppStore } from "./store.js";
import { createWorkSessionActions } from "./work-session-actions.js";
import { createWorkspaceActions } from "./workspace-actions.js";

export { ApiError } from "../../domain-client/index.js";
export type {
  ClientFetch,
  Host,
  Invitation,
  InvitationDecision,
  Membership,
  Organization,
  ProjectEntry,
  ProjectFile,
  ProjectTarget,
  RepositoryInput,
  Source,
  UserMessage,
  WorkSession,
  Workspace,
} from "../../domain-client/index.js";
export { createMemoryHistory } from "../../domain-client/history.js";
export type { History, MemoryHistory } from "../../domain-client/history.js";
export type { AppEvent } from "./events.js";
export { actionKeys, confirmKeys, loadKeys } from "./keys.js";
export {
  defaultRoute,
  pathToRoute,
  requiresAuthentication,
  routeToPath,
} from "./router.js";
export type { Route } from "./router.js";
export {
  currentOrganization,
  currentWorkSession,
  currentWorkspace,
  hasLoaded,
  isConfirming,
  isPending,
  managesOrganization,
  routeOrganizationId,
  visibleRoute,
} from "./selectors.js";
export type {
  AppError,
  AppOwnState,
  AppState,
  CreateForm,
  CredentialsDraft,
  InviteDraft,
  NameDraft,
  SignUpDraft,
} from "./state.js";

export type AppCoreDependencies = {
  baseUrl: string;
  host: Host;
  history: History;
};

/**
 * The application client: the headless core (domain-client) composed — never
 * duplicated — with the routing, drafts and guards a product UI needs.
 * Call `session.load()` once at boot; until it resolves, the app does not yet
 * know whether the browser's cookie names a user.
 */
export function createAppCore(dependencies: AppCoreDependencies) {
  const client = createClientCore({
    baseUrl: dependencies.baseUrl,
    host: dependencies.host,
  });
  const store = createAppStore(client);
  const context: AppActionContext = {
    client,
    store,
    navigation: createAppNavigation(dependencies.history, store),
    attempt: createAttempt(client, store),
  };

  return {
    session: createSessionActions(context),
    organizations: createOrganizationActions(context),
    members: createMemberActions(context),
    invitations: createInvitationActions(context),
    inbox: createInboxActions(context),
    workspaces: createWorkspaceActions(context),
    repositories: createRepositoryActions(context),
    workSessions: createWorkSessionActions(context),
    projectFiles: createProjectFileActions(context),
    confirmation: createConfirmationActions(context),
    notices: createNoticeActions(context),
    navigation: context.navigation,
    getState: store.getState,
    subscribe: store.subscribe,
  };
}

export type AppCore = ReturnType<typeof createAppCore>;
