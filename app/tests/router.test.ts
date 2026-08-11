import { describe, expect, it } from "vitest";

import {
  defaultRoute,
  pathToRoute,
  requiresAuthentication,
  routeToPath,
  visibleRoute,
} from "../client/index.js";
import type { AppState, Route } from "../client/index.js";

/** Only the two slices the guard reads; the rest of the tree is irrelevant. */
function stateAt(route: Route, signedIn: boolean): AppState {
  return {
    route,
    auth: signedIn
      ? {
          status: "authenticated",
          user: { id: "user-1", name: "Ada", email: "ada@example.test" },
        }
      : { status: "anonymous" },
  } as AppState;
}

describe("router", () => {
  it("round-trips every route through its path", () => {
    const routes: Route[] = [
      { kind: "home" },
      { kind: "sign-in" },
      { kind: "sign-up" },
      { kind: "dashboard" },
      { kind: "organization", organizationId: "org-1" },
      { kind: "workspace", organizationId: "org-1", workspaceId: "ws-1" },
      {
        kind: "session",
        organizationId: "org-1",
        workspaceId: "ws-1",
        workSessionId: "session-1",
      },
    ];
    for (const route of routes)
      expect(pathToRoute(routeToPath(route))).toEqual(route);
  });

  it("lands unknown paths on the home page", () => {
    expect(pathToRoute("/pricing")).toEqual(defaultRoute);
    expect(pathToRoute("")).toEqual(defaultRoute);
    expect(pathToRoute("/?utm_source=x")).toEqual(defaultRoute);
  });

  it("treats an incomplete app path as the dashboard", () => {
    expect(pathToRoute("/app/organizations")).toEqual({ kind: "dashboard" });
    expect(pathToRoute("/app/anything")).toEqual({ kind: "dashboard" });
  });

  it("falls back to the organization when the workspace path is incomplete", () => {
    expect(pathToRoute("/app/organizations/org-1/workspaces")).toEqual({
      kind: "organization",
      organizationId: "org-1",
    });
    expect(pathToRoute("/app/organizations/org-1/settings")).toEqual({
      kind: "organization",
      organizationId: "org-1",
    });
  });

  it("encodes organization ids in both directions", () => {
    const route: Route = { kind: "organization", organizationId: "a/b c" };
    expect(routeToPath(route)).toBe("/app/organizations/a%2Fb%20c");
    expect(pathToRoute(routeToPath(route))).toEqual(route);
  });

  it("knows which routes are behind the login", () => {
    expect(requiresAuthentication({ kind: "dashboard" })).toBe(true);
    expect(
      requiresAuthentication({ kind: "organization", organizationId: "x" }),
    ).toBe(true);
    expect(
      requiresAuthentication({
        kind: "workspace",
        organizationId: "x",
        workspaceId: "y",
      }),
    ).toBe(true);
    expect(
      requiresAuthentication({
        kind: "session",
        organizationId: "x",
        workspaceId: "y",
        workSessionId: "z",
      }),
    ).toBe(true);
    expect(requiresAuthentication({ kind: "home" })).toBe(false);
    expect(requiresAuthentication({ kind: "sign-in" })).toBe(false);
  });
});

describe("visibleRoute", () => {
  it("shows the sign-in page for a page behind the login", () => {
    expect(visibleRoute(stateAt({ kind: "dashboard" }, false))).toEqual({
      kind: "sign-in",
    });
  });

  it("keeps public pages public", () => {
    expect(visibleRoute(stateAt({ kind: "home" }, false))).toEqual({
      kind: "home",
    });
    expect(visibleRoute(stateAt({ kind: "home" }, true))).toEqual({
      kind: "home",
    });
  });

  it("sends a signed-in visitor past the credential forms", () => {
    expect(visibleRoute(stateAt({ kind: "sign-in" }, true))).toEqual({
      kind: "dashboard",
    });
    expect(visibleRoute(stateAt({ kind: "sign-up" }, true))).toEqual({
      kind: "dashboard",
    });
  });

  it("shows the requested page once the visitor is signed in", () => {
    const route: Route = { kind: "organization", organizationId: "org-1" };
    expect(visibleRoute(stateAt(route, true))).toEqual(route);
  });
});
