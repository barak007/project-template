import { describe } from "vitest";

import { it } from "./kit/fixtures.js";

describe("founder onboarding story", () => {
  it.concurrent(
    "signs up, creates an organization, and finds it again after sign-out and sign-in",
    async ({ world, expect }) => {
      const app = world.newClient();
      const email = world.uniqueEmail("ada");

      await app.signUp({ email, password: "hunter2hunter2", name: "Ada" });
      expect(app.getState().auth).toMatchObject({
        status: "authenticated",
        user: { name: "Ada", email },
      });

      await app.createOrganization({ name: "Analytical Engines" });
      expect(app.getState().organizations).toHaveLength(1);

      await app.signOut();
      expect(app.getState().auth.status).toBe("anonymous");
      expect(app.getState().organizations).toHaveLength(0);

      await app.signIn({ email, password: "hunter2hunter2" });
      await app.loadOrganizations();
      expect(app.getState().organizations.map(({ name }) => name)).toEqual([
        "Analytical Engines",
      ]);
    },
  );

  it.concurrent(
    "rejects an invalid organization name with the server's validation error",
    async ({ world, expect }) => {
      const { core } = await world.signedUpUser("ada");

      await expect(core.createOrganization({ name: "" })).rejects.toMatchObject(
        { name: "ApiError" },
      );
      expect(core.getState().organizations).toHaveLength(0);
    },
  );

  it.concurrent(
    "keeps each founder's organizations to themselves",
    async ({ world, expect }) => {
      const ada = await world.signedUpUser("ada");
      const grace = await world.signedUpUser("grace");

      await ada.core.createOrganization({ name: "Analytical Engines" });
      await grace.core.createOrganization({ name: "Compilers Inc" });

      await ada.core.loadOrganizations();
      await grace.core.loadOrganizations();
      expect(ada.core.getState().organizations.map(({ name }) => name)).toEqual(
        ["Analytical Engines"],
      );
      expect(
        grace.core.getState().organizations.map(({ name }) => name),
      ).toEqual(["Compilers Inc"]);
    },
  );
});
