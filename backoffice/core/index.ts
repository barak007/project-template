import type { Host } from "../../client/src/index.js";
import { createStore } from "../../client/src/store.js";

import { createAdminActions } from "./admin-actions.js";
import { createApi } from "./api.js";
import { createBackofficeAuthActions } from "./auth-actions.js";
import { reduce } from "./projection.js";
import { initialBackofficeState } from "./state.js";

export { ApiError } from "../../client/src/errors.js";
export type { ClientFetch, Host } from "../../client/src/index.js";
export type {
  AdminOrganization,
  AdminUser,
  OrganizationDetail,
} from "./api.js";
export type { BackofficeEvent } from "./events.js";
export type {
  BackofficeAuthError,
  BackofficeAuthState,
  BackofficeState,
} from "./state.js";

export type BackofficeCoreDependencies = {
  baseUrl: string;
  host: Host;
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
    getState: store.getState,
    subscribe: store.subscribe,
  };
}

export type BackofficeCore = ReturnType<typeof createBackofficeCore>;
