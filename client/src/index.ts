import { createApi } from "./api.js";
import type { ClientFetch } from "./api.js";
import { createAuthActions } from "./auth-actions.js";
import { createOrganizationActions } from "./organization-actions.js";
import { initialState } from "./state.js";
import type { ClientState } from "./state.js";
import { createStore } from "./store.js";

export { ApiError } from "./errors.js";
export type { ClientFetch, Organization } from "./api.js";
export type { AuthState, AuthUser, ClientState } from "./state.js";

export type ClientCoreDependencies = {
  baseUrl: string;
  fetch: ClientFetch;
};

export function createClientCore(dependencies: ClientCoreDependencies) {
  const store = createStore<ClientState>(initialState);
  const api = createApi(dependencies.baseUrl, dependencies.fetch);
  return {
    ...createAuthActions(dependencies.baseUrl, dependencies.fetch, store),
    ...createOrganizationActions(api, store),
    getState: store.getState,
    subscribe: store.subscribe,
  };
}

export type ClientCore = ReturnType<typeof createClientCore>;
