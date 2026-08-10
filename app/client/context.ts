import type { ClientCore } from "../../domain-client/index.js";

import type { Attempt } from "./attempt.js";
import type { AppNavigation } from "./navigation-actions.js";
import type { AppStore } from "./store.js";

/**
 * What every app action namespace is built from: the composed client core for
 * anything the server owns, the store for what the app owns, navigation for
 * where the user goes next, and `attempt` for the failure contract.
 */
export type AppActionContext = {
  client: ClientCore;
  store: AppStore;
  navigation: AppNavigation;
  attempt: Attempt;
};
