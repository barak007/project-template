import { describe, expect, it } from "vitest";

import {
  createBackofficeCore,
  createMemoryHistory,
  pathToRoute,
  routeToPath,
} from "../client/index.js";
import type { Route } from "../client/index.js";

/** A core with no reachable server — routing never touches the network. */
function coreAt(path: string) {
  const history = createMemoryHistory(path);
  const core = createBackofficeCore({
    baseUrl: "http://unused.test",
    host: {
      fetch: () => Promise.reject(new Error("network must not be used")),
    },
    history,
  });
  return { core, history };
}

describe("router", () => {
  it("round-trips every route through its path", () => {
    const routes: Route[] = [
      { kind: "users" },
      { kind: "user", userId: "user-1" },
      { kind: "organizations" },
      { kind: "organization", organizationId: "org-1" },
      { kind: "table", table: "work_sessions" },
      {
        kind: "table",
        table: "account",
        filters: [{ column: "userId", op: "eq", value: "user-1" }],
      },
      {
        kind: "table",
        table: "account",
        filters: [{ column: "email", op: "starts-with", value: "a" }],
        limit: 100,
        offset: 200,
      },
      { kind: "table", table: "account", offset: 200 },
    ];
    for (const route of routes)
      expect(pathToRoute(routeToPath(route))).toEqual(route);
  });

  it("keeps default pagination out of the path", () => {
    expect(
      routeToPath({ kind: "table", table: "account", limit: 50, offset: 0 }),
    ).toBe("/tables/account");
    expect(
      routeToPath({ kind: "table", table: "account", limit: 25, offset: 0 }),
    ).toBe("/tables/account?limit=25");
  });

  it("ignores malformed pagination query params", () => {
    expect(pathToRoute("/tables/account?limit=abc&offset=-5")).toEqual({
      kind: "table",
      table: "account",
    });
    expect(pathToRoute("/tables/account?limit=25.5&offset=10")).toEqual({
      kind: "table",
      table: "account",
      offset: 10,
    });
  });

  it("lands unknown paths on the default route", () => {
    expect(pathToRoute("/")).toEqual({ kind: "users" });
    expect(pathToRoute("/no/such/page")).toEqual({ kind: "users" });
  });

  it("drops malformed or empty filter query strings", () => {
    expect(pathToRoute("/tables/account?filters=not-json")).toEqual({
      kind: "table",
      table: "account",
    });
    expect(pathToRoute("/tables/account?filters=%7B%22a%22%3A1%7D")).toEqual({
      kind: "table",
      table: "account",
    });
    expect(pathToRoute("/tables/account?filters=%5B%5D")).toEqual({
      kind: "table",
      table: "account",
    });
  });
});

describe("navigation", () => {
  it("boots on the route the URL names and normalizes the path", () => {
    const { core, history } = coreAt("/tables/sources");
    expect(core.getState().route).toEqual({ kind: "table", table: "sources" });
    expect(history.path()).toBe("/tables/sources");

    const atRoot = coreAt("/");
    expect(atRoot.core.getState().route).toEqual({ kind: "users" });
    expect(atRoot.history.path()).toBe("/users");
  });

  it("navigate updates both the state and the URL", () => {
    const { core, history } = coreAt("/users");
    core.navigation.navigate({ kind: "organizations" });
    expect(core.getState().route).toEqual({ kind: "organizations" });
    expect(history.path()).toBe("/organizations");
  });

  it("follows environment-driven history changes (browser back)", () => {
    const { core, history } = coreAt("/users");
    core.navigation.navigate({ kind: "table", table: "user" });
    history.back();
    expect(core.getState().route).toEqual({ kind: "users" });
  });

  it("stays put when back is pressed at the start of history", () => {
    const { core, history } = coreAt("/organizations");
    history.back();
    expect(history.path()).toBe("/organizations");
    expect(core.getState().route).toEqual({ kind: "organizations" });
  });

  it("keeps the route across sign-out", () => {
    const { core } = coreAt("/tables/sources");
    core.navigation.navigate({ kind: "organizations" });
    // signed-out resets admin data but not where the operator is looking.
    expect(core.getState().route).toEqual({ kind: "organizations" });
  });
});
