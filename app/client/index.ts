import type { History } from "../../domain-client/history.js";
import { createClientCore } from "../../domain-client/index.js";
import type { Host } from "../../domain-client/index.js";

import { createAttempt } from "./attempt.js";
import type { AppActionContext } from "./context.js";
import { createAppNavigation } from "./navigation-actions.js";
import { createOrganizationActions } from "./organization-actions.js";
import { createRepositoryActions } from "./repository-actions.js";
import { createSessionActions } from "./session-actions.js";
import { createAppStore } from "./store.js";
import { createWorkspaceActions } from "./workspace-actions.js";

export { ApiError } from "../../domain-client/index.js";
export type {
  ClientFetch,
  Host,
  Organization,
  Source,
  Workspace,
} from "../../domain-client/index.js";
export { createMemoryHistory } from "../../domain-client/history.js";
export type { History, MemoryHistory } from "../../domain-client/history.js";
export type { AppEvent } from "./events.js";
export {
  defaultRoute,
  pathToRoute,
  requiresAuthentication,
  routeToPath,
} from "./router.js";
export type { Route } from "./router.js";
export {
  currentOrganization,
  currentWorkspace,
  routeOrganizationId,
  visibleRoute,
} from "./selectors.js";
export type {
  AppError,
  AppOwnState,
  AppState,
  CredentialsDraft,
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
    workspaces: createWorkspaceActions(context),
    repositories: createRepositoryActions(context),
    navigation: context.navigation,
    getState: store.getState,
    subscribe: store.subscribe,
  };
}

export type AppCore = ReturnType<typeof createAppCore>;
