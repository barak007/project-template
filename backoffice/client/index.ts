import type { Host } from "../../client/index.js";
import { createStore } from "../../client/store.js";

import { createAdminActions } from "./admin-actions.js";
import { createApi } from "./api.js";
import { createBackofficeAuthActions } from "./auth-actions.js";
import { createDataActions } from "./data-actions.js";
import type { History } from "./history.js";
import { createNavigation } from "./navigation-actions.js";
import { reduce } from "./projection.js";
import { initialBackofficeState } from "./state.js";

export { ApiError } from "../../client/errors.js";
export type { ClientFetch, Host } from "../../client/index.js";
export type {
  AdminOrganization,
  AdminUser,
  ColumnMeta,
  OrganizationDetail,
  RowsPage,
  TableMeta,
  TableRow,
} from "./api.js";
export { defaultTableQuery } from "./data-actions.js";
export type { RowFilter, TableQuery } from "./data-actions.js";
export type { BackofficeEvent } from "./events.js";
export { createMemoryHistory } from "./history.js";
export type { History, MemoryHistory } from "./history.js";
export { defaultRoute, pathToRoute, routeToPath } from "./router.js";
export type { Route } from "./router.js";
export { visibleOrganizations, visibleUsers } from "./selectors.js";
export type {
  BackofficeAuthError,
  BackofficeAuthState,
  BackofficeError,
  BackofficeState,
  OrganizationsPageState,
  TableDataState,
  UserDraft,
  UsersPageState,
} from "./state.js";

export type BackofficeCoreDependencies = {
  baseUrl: string;
  host: Host;
  history: History;
};

/**
 * The backoffice admin is a standalone server-side credential, not an
 * application user, so the backoffice owns its auth flow instead of
 * composing the application client core. Call `auth.loadStatus()` once at
 * boot: it resolves whether the credential is configured (else the UI shows
 * first-run setup) and whether this browser already holds a session.
 */
export function createBackofficeCore(dependencies: BackofficeCoreDependencies) {
  const store = createStore(reduce, initialBackofficeState);
  const api = createApi(dependencies.baseUrl, dependencies.host);

  return {
    auth: createBackofficeAuthActions(api, store),
    admin: createAdminActions(api, store),
    data: createDataActions(api, store),
    navigation: createNavigation(dependencies.history, store),
    getState: store.getState,
    subscribe: store.subscribe,
  };
}

export type BackofficeCore = ReturnType<typeof createBackofficeCore>;
