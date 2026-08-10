import { describe, expect, it } from "vitest";

import type { ClientState } from "../../domain-client/index.js";
import { createStore } from "../../domain-client/store.js";
import { createAppStore } from "../client/store.js";

type OrganizationsChanged = { organizations: ClientState["organizations"] };

/** A stand-in for the client core: only the slices the app store observes. */
function fakeClient() {
  const initial = {
    auth: { status: "anonymous" },
    organizations: [],
  } as unknown as ClientState;
  return createStore(
    (state: ClientState, event: OrganizationsChanged) => ({
      ...state,
      organizations: event.organizations,
    }),
    initial,
  );
}

describe("the app store", () => {
  it("exposes the client's slices and its own as one tree", () => {
    const client = fakeClient();
    const store = createAppStore(client);

    expect(store.getState().organizations).toEqual([]);
    expect(store.getState().route).toEqual({ kind: "home" });
  });

  it("returns the same snapshot until something changes", () => {
    const store = createAppStore(fakeClient());
    const first = store.getState();

    expect(store.getState()).toBe(first);

    store.dispatch({ type: "session-resolved" });
    expect(store.getState()).not.toBe(first);
  });

  it("notifies subscribers about either half of the tree", () => {
    const client = fakeClient();
    const store = createAppStore(client);
    let notifications = 0;
    const unsubscribe = store.subscribe(() => (notifications += 1));

    store.dispatch({ type: "session-resolved" });
    client.dispatch({ organizations: [] });
    expect(notifications).toBe(2);

    unsubscribe();
    store.dispatch({ type: "navigated", route: { kind: "dashboard" } });
    expect(notifications).toBe(2);
    // Unsubscribing stops the notifications, not the state.
    expect(store.getState().route).toEqual({ kind: "dashboard" });
  });
});
