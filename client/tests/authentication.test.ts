import { describe } from "vitest";

import { ApiError } from "../src/index.js";

import { it } from "./kit/fixtures.js";

describe("authentication stories", () => {
  it.concurrent(
    "rejects a wrong password as state, not a throw",
    async ({ world, expect }) => {
      const { credentials } = await world.signedUpUser("ada");
      const intruder = world.newClient();

      await intruder.auth.signIn({
        ...credentials,
        password: "not-the-password",
      });

      const auth = intruder.getState().auth;
      expect(auth.status).toBe("anonymous");
      if (auth.status !== "anonymous") return;
      expect(auth.error?.code).toBeTruthy();
      expect(auth.error?.message).toBeTruthy();
    },
  );

  it.concurrent(
    "signing out on one device keeps the other device's session alive",
    async ({ world, expect }) => {
      const laptop = await world.signedUpUser("ada");
      const phone = world.newClient();
      await phone.auth.signIn(laptop.credentials);

      await laptop.core.auth.signOut();

      await phone.organizations.load();
      expect(phone.getState().auth.status).toBe("authenticated");
      expect(laptop.core.getState().auth.status).toBe("anonymous");
    },
  );

  it.concurrent(
    "surfaces the server's error envelope when acting anonymously",
    async ({ world, expect }) => {
      const anonymous = world.newClient();

      await expect(anonymous.organizations.load()).rejects.toThrowError(
        ApiError,
      );
      await expect(anonymous.organizations.load()).rejects.toMatchObject({
        code: "AUTHENTICATION_REQUIRED",
      });
    },
  );

  it.concurrent(
    "notifies subscribers on every state change",
    async ({ world, expect }) => {
      const { core } = await world.signedUpUser("ada");
      let notifications = 0;
      const unsubscribe = core.subscribe(() => (notifications += 1));

      await core.organizations.create({ name: "Analytical Engines" });
      expect(notifications).toBe(1);

      unsubscribe();
      await core.auth.signOut();
      expect(notifications).toBe(1);
    },
  );
});
