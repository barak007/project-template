import { describe } from "vitest";

import { it } from "./kit/fixtures.js";

describe("secret stories", () => {
  it.concurrent(
    "secret keys are listed but values never enter client state",
    async ({ world, expect }) => {
      const { core, organization } = await world.founder("ada");

      await core.organizationSecrets.put(organization.id, {
        key: "API_KEY",
        value: "org-secret-value",
      });
      await core.userSecrets.put({
        key: "TOKEN",
        value: "user-secret-value",
      });

      await core.organizationSecrets.load(organization.id);
      await core.userSecrets.load();
      expect(core.getState().organizationSecrets.map(({ key }) => key)).toEqual(
        ["API_KEY"],
      );
      expect(core.getState().userSecrets.map(({ key }) => key)).toEqual([
        "TOKEN",
      ]);

      const everything = JSON.stringify(core.getState());
      expect(everything).not.toContain("org-secret-value");
      expect(everything).not.toContain("user-secret-value");

      await core.organizationSecrets.delete(organization.id, "API_KEY");
      await core.userSecrets.delete("TOKEN");
      expect(core.getState().organizationSecrets).toHaveLength(0);
      expect(core.getState().userSecrets).toHaveLength(0);
    },
  );

  it.concurrent(
    "putting a secret twice keeps one entry per key",
    async ({ world, expect }) => {
      const { core, organization } = await world.founder("ada");

      await core.organizationSecrets.put(organization.id, {
        key: "API_KEY",
        value: "first",
      });
      await core.organizationSecrets.put(organization.id, {
        key: "API_KEY",
        value: "second",
      });

      expect(core.getState().organizationSecrets).toHaveLength(1);
      await core.organizationSecrets.load(organization.id);
      expect(core.getState().organizationSecrets).toHaveLength(1);
    },
  );
});
