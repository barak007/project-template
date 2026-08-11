import { createApi } from "./api.js";
import { createAuthActions } from "./auth-actions.js";
import {
  createOrganizationDataActions,
  createUserDataActions,
} from "./data-actions.js";
import type { Host } from "./host.js";
import { createMemberActions } from "./member-actions.js";
import { createOrganizationActions } from "./organization-actions.js";
import { reduce } from "./projection.js";
import { createRepositoryActions } from "./repository-actions.js";
import {
  createOrganizationSecretActions,
  createUserSecretActions,
} from "./secret-actions.js";
import { createSessionFileActions } from "./session-file-actions.js";
import { createSourceActions } from "./source-actions.js";
import { initialState } from "./state.js";
import { createStore } from "./store.js";
import { createWorkSessionActions } from "./work-session-actions.js";
import { createWorkspaceActions } from "./workspace-actions.js";

export { ApiError } from "./errors.js";
export type {
  DataEntry,
  Membership,
  Organization,
  ProjectEntry,
  ProjectFile,
  RepositoryInput,
  Secret,
  Source,
  WorkSession,
  Workspace,
} from "./api.js";
export type { ClientEvent } from "./events.js";
export type { ClientFetch, Host } from "./host.js";
export type {
  AuthState,
  AuthUser,
  ClientState,
  SessionFilesState,
} from "./state.js";

export type ClientCoreDependencies = {
  baseUrl: string;
  host: Host;
};

export function createClientCore(dependencies: ClientCoreDependencies) {
  const store = createStore(reduce, initialState);
  const api = createApi(dependencies.baseUrl, dependencies.host);
  return {
    auth: createAuthActions(dependencies.baseUrl, dependencies.host, store),
    organizations: createOrganizationActions(api, store),
    members: createMemberActions(api, store),
    repositories: createRepositoryActions(api, store),
    sources: createSourceActions(api, store),
    workspaces: createWorkspaceActions(api, store),
    workSessions: createWorkSessionActions(api, store),
    sessionFiles: createSessionFileActions(api, store),
    organizationSecrets: createOrganizationSecretActions(api, store),
    userSecrets: createUserSecretActions(api, store),
    organizationData: createOrganizationDataActions(api, store),
    userData: createUserDataActions(api, store),
    getState: store.getState,
    subscribe: store.subscribe,
  };
}

export type ClientCore = ReturnType<typeof createClientCore>;
