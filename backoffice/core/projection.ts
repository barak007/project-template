import type { Store } from "../../client/src/store.js";

import type { AdminEvent } from "./events.js";
import { initialAdminState } from "./state.js";
import type { AdminState } from "./state.js";

export type AdminStore = Store<AdminState, AdminEvent>;

export function reduce(state: AdminState, event: AdminEvent): AdminState {
  switch (event.type) {
    case "reset":
      return initialAdminState;
    case "users-loaded":
      return { ...state, users: event.users };
    case "organizations-loaded":
      return { ...state, organizations: event.organizations };
    case "organization-detail-loaded":
      return { ...state, organizationDetail: event.detail };
  }
}
