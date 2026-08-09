import { describe } from "vitest";

import { it } from "./kit/fixtures.js";

describe("founder onboarding story", () => {
  it.concurrent(
    "signs up, creates an organization, and finds it again after sign-out and sign-in",
    async ({ world, expect }) => {
      const app = world.newClient();
      const email = world.uniqueEmail("ada");

      await app.auth.signUp({ email, password: "hunter2hunter2", name: "Ada" });
      expect(app.getState().auth).toMatchObject({
        status: "authenticated",
        user: { name: "Ada", email },
      });

      await app.organizations.create({ name: "Analytical Engines" });
      expect(app.getState().organizations).toHaveLength(1);

      await app.auth.signOut();
      expect(app.getState().auth.status).toBe("anonymous");
      expect(app.getState().organizations).toHaveLength(0);

      await app.auth.signIn({ email, password: "hunter2hunter2" });
      await app.organizations.load();
      expect(app.getState().organizations.map(({ name }) => name)).toEqual([
        "Analytical Engines",
      ]);
    },
  );

  it.concurrent(
    "rejects an invalid organization name with the server's validation error",
    async ({ world, expect }) => {
      const { core } = await world.signedUpUser("ada");

      await expect(
        core.organizations.create({ name: "" }),
      ).rejects.toMatchObject({ name: "ApiError" });
      expect(core.getState().organizations).toHaveLength(0);
    },
  );

  it.concurrent(
    "keeps each founder's organizations to themselves",
    async ({ world, expect }) => {
      const ada = await world.signedUpUser("ada");
      const grace = await world.signedUpUser("grace");

      await ada.core.organizations.create({ name: "Analytical Engines" });
      await grace.core.organizations.create({ name: "Compilers Inc" });

      await ada.core.organizations.load();
      await grace.core.organizations.load();
      expect(ada.core.getState().organizations.map(({ name }) => name)).toEqual(
        ["Analytical Engines"],
      );
      expect(
        grace.core.getState().organizations.map(({ name }) => name),
      ).toEqual(["Compilers Inc"]);
    },
  );
});
