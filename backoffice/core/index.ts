import { createClientCore } from "../../client/src/index.js";
import type { Host } from "../../client/src/index.js";
import { createStore } from "../../client/src/store.js";

import { createAdminActions } from "./admin-actions.js";
import { createApi } from "./api.js";
import { reduce } from "./projection.js";
import { initialAdminState } from "./state.js";
import type { BackofficeState } from "./state.js";

export { ApiError } from "../../client/src/errors.js";
export type {
  AuthState,
  AuthUser,
  ClientFetch,
  Host,
} from "../../client/src/index.js";
export type {
  AdminOrganization,
  AdminUser,
  OrganizationDetail,
} from "./api.js";
export type { AdminEvent } from "./events.js";
export type { BackofficeState } from "./state.js";

export type BackofficeCoreDependencies = {
  baseUrl: string;
  host: Host;
};

/**
 * The backoffice composes the application client core — auth (and any future
 * tenant-side operation) is the client's, never reimplemented — and adds the
 * platform-admin slices on top, exposed as one combined state.
 */
export function createBackofficeCore(dependencies: BackofficeCoreDependencies) {
  const client = createClientCore(dependencies);
  const adminStore = createStore(reduce, initialAdminState);
  const api = createApi(dependencies.baseUrl, dependencies.host);

  const listeners = new Set<() => void>();
  let snapshot: BackofficeState = {
    auth: client.getState().auth,
    ...adminStore.getState(),
  };
  const rebuild = () => {
    snapshot = { auth: client.getState().auth, ...adminStore.getState() };
    for (const listener of listeners) listener();
  };
  adminStore.subscribe(rebuild);
  client.subscribe(() => {
    // Signing out through the client core wipes admin data with it.
    if (
      snapshot.auth.status === "authenticated" &&
      client.getState().auth.status === "anonymous"
    )
      adminStore.dispatch({ type: "reset" });
    rebuild();
  });

  return {
    client,
    auth: client.auth,
    admin: createAdminActions(api, adminStore),
    getState: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type BackofficeCore = ReturnType<typeof createBackofficeCore>;
