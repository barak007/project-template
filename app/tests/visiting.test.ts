import { describe } from "vitest";

import { it } from "../../domain-client/tests/kit/fixtures.js";
import { routeToPath, visibleRoute } from "../client/index.js";

import { signIn, signUp, visit } from "./harness.js";

describe("visiting the app", () => {
  it.concurrent(
    "a new visitor signs up and lands in the app",
    async ({ world, expect }) => {
      const { core } = visit(world, "/sign-up");

      await signUp(core, {
        name: "Ada",
        email: world.uniqueEmail("ada"),
        password: "password-for-ada",
      });

      const state = core.getState();
      expect(state.auth.status).toBe("authenticated");
      expect(state.route).toEqual({ kind: "dashboard" });
      // The typed password is not kept around after it has been used.
      expect(state.signUpDraft).toEqual({ name: "", email: "", password: "" });
    },
  );

  it.concurrent(
    "a rejected password is state on the form, not a throw",
    async ({ world, expect }) => {
      const { credentials } = await world.signedUpUser("grace");
      const { core } = visit(world, "/sign-in");

      await signIn(core, {
        email: credentials.email,
        password: "not-the-password",
      });

      const state = core.getState();
      expect(state.route).toEqual({ kind: "sign-in" });
      if (state.auth.status !== "anonymous") throw new Error("signed in");
      expect(state.auth.error?.message).toBeTruthy();
      // A retry needs the email again only if the visitor clears it.
      expect(state.signInDraft.email).toBe(credentials.email);
    },
  );

  it.concurrent(
    "a link into the app shows the sign-in page and then the page asked for",
    async ({ world, expect }) => {
      const founder = await world.founder("ada");
      const target = {
        kind: "organization" as const,
        organizationId: founder.organization.id,
      };
      const { core, history } = visit(world, routeToPath(target));

      expect(visibleRoute(core.getState())).toEqual({ kind: "sign-in" });

      await signIn(core, founder.credentials);

      expect(visibleRoute(core.getState())).toEqual(target);
      expect(history.path()).toBe(routeToPath(target));
    },
  );

  it.concurrent(
    "a reload keeps the visitor signed in",
    async ({ world, expect }) => {
      const visitor = visit(world, "/sign-up");
      await signUp(visitor.core, {
        name: "Grace",
        email: world.uniqueEmail("grace"),
        password: "password-for-grace",
      });

      const reopened = visitor.reload();
      expect(reopened.getState().sessionResolved).toBe(false);

      await reopened.session.load();

      const state = reopened.getState();
      expect(state.sessionResolved).toBe(true);
      expect(state.auth.status).toBe("authenticated");
      expect(state.route).toEqual({ kind: "dashboard" });
    },
  );

  it.concurrent(
    "a first visit resolves to an anonymous session",
    async ({ world, expect }) => {
      const { core } = visit(world);

      await core.session.load();

      const state = core.getState();
      expect(state.sessionResolved).toBe(true);
      expect(state.auth.status).toBe("anonymous");
      expect(visibleRoute(state)).toEqual({ kind: "home" });
    },
  );

  it.concurrent(
    "signing out returns to the public home page",
    async ({ world, expect }) => {
      const founder = await world.founder("ada");
      const { core, history } = visit(world, "/sign-in");
      await signIn(core, founder.credentials);
      await core.organizations.load();

      await core.session.signOut();

      const state = core.getState();
      expect(state.auth.status).toBe("anonymous");
      expect(state.route).toEqual({ kind: "home" });
      expect(history.path()).toBe("/");
      // Signing out drops everything the identity could see.
      expect(state.organizations).toEqual([]);
    },
  );

  it.concurrent(
    "a session that ended elsewhere sends the visitor back to sign-in",
    async ({ world, expect }) => {
      const visitor = visit(world, "/sign-up");
      await signUp(visitor.core, {
        name: "Ada",
        email: world.uniqueEmail("ada"),
        password: "password-for-ada",
      });
      // The same browser, another tab: signing out there ends this session.
      await visitor.reload().session.signOut();

      await visitor.core.organizations.load();

      const state = visitor.core.getState();
      expect(state.auth.status).toBe("anonymous");
      // An expired session is not an error message — it is the sign-in page.
      expect(state.error).toBeNull();
      expect(visibleRoute({ ...state, route: { kind: "dashboard" } })).toEqual({
        kind: "sign-in",
      });
    },
  );
});
