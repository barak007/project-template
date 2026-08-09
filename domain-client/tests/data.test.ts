import { describe } from "vitest";

import { it } from "./kit/fixtures.js";

describe("data stories", () => {
  it.concurrent(
    "organization and user data round-trip and upsert by key",
    async ({ world, expect }) => {
      const { core, organization } = await world.founder("ada");

      await core.organizationData.put(organization.id, {
        key: "region",
        value: "eu",
      });
      await core.organizationData.put(organization.id, {
        key: "region",
        value: "us",
      });
      await core.organizationData.put(organization.id, {
        key: "quota",
        value: { limit: 10 },
      });

      await core.organizationData.load(organization.id);
      expect(
        Object.fromEntries(
          core
            .getState()
            .organizationData.map(({ key, value }) => [key, value]),
        ),
      ).toEqual({ region: "us", quota: { limit: 10 } });

      await core.userData.put({ key: "theme", value: "dark" });
      await core.userData.put({ key: "theme", value: "light" });
      await core.userData.load();
      expect(
        Object.fromEntries(
          core.getState().userData.map(({ key, value }) => [key, value]),
        ),
      ).toEqual({ theme: "light" });
    },
  );
});
