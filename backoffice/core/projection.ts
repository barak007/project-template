import type { Store } from "../../client/src/store.js";

import type { BackofficeEvent } from "./events.js";
import { initialAdminState } from "./state.js";
import type { BackofficeState } from "./state.js";

export type BackofficeStore = Store<BackofficeState, BackofficeEvent>;

export function reduce(
  state: BackofficeState,
  event: BackofficeEvent,
): BackofficeState {
  switch (event.type) {
    case "auth-status-loaded":
      return {
        ...state,
        auth:
          event.authenticated && event.email !== undefined
            ? { status: "authenticated", email: event.email }
            : event.configured
              ? { status: "anonymous" }
              : { status: "needs-setup" },
      };
    case "signed-in":
      return {
        ...initialAdminState,
        auth: { status: "authenticated", email: event.email },
      };
    case "auth-failed":
      return {
        ...state,
        auth: {
          status:
            state.auth.status === "needs-setup" ? "needs-setup" : "anonymous",
          error: event.error,
        },
      };
    // Signing out wipes the admin data with it.
    case "signed-out":
      return { ...initialAdminState, auth: { status: "anonymous" } };
    case "users-loaded":
      return { ...state, users: event.users };
    case "organizations-loaded":
      return { ...state, organizations: event.organizations };
    case "organization-detail-loaded":
      return { ...state, organizationDetail: event.detail };
  }
}
