import { describe } from "vitest";

import { browserFetch } from "../../client/tests/kit/browser-fetch.js";
import { it } from "../../client/tests/kit/fixtures.js";
import type { World } from "../../client/tests/kit/world.js";
import { ApiError, createBackofficeCore } from "../core/index.js";

function newBackofficeClient(world: World) {
  return createBackofficeCore({
    baseUrl: world.baseUrl,
    host: { fetch: browserFetch(world.request) },
  });
}

async function signedInBackoffice(
  world: World,
  credentials: { email: string; password: string },
) {
  const backoffice = newBackofficeClient(world);
  await backoffice.auth.signIn(credentials);
  if (backoffice.getState().auth.status !== "authenticated")
    throw new Error("Backoffice sign-in failed");
  return backoffice;
}

describe("backoffice admin console", () => {
  it.concurrent(
    "keeps sign-in failures as state, never thrown",
    async ({ world, expect }) => {
      const backoffice = newBackofficeClient(world);
      await backoffice.auth.signIn({
        email: world.uniqueEmail("nobody"),
        password: "wrong-password",
      });
      const { auth } = backoffice.getState();
      expect(auth.status).toBe("anonymous");
      if (auth.status === "anonymous") expect(auth.error).toBeDefined();
    },
  );

  it.concurrent(
    "rejects a signed-in non-admin with a FORBIDDEN ApiError",
    async ({ world, expect }) => {
      const persona = await world.signedUpUser();
      const backoffice = await signedInBackoffice(world, persona.credentials);
      const failure = backoffice.admin.loadUsers();
      await expect(failure).rejects.toBeInstanceOf(ApiError);
      await expect(failure).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(backoffice.getState().users).toHaveLength(0);
    },
  );

  it.concurrent(
    "shows a platform admin every user and organization",
    async ({ world, expect }) => {
      const admin = await world.platformAdmin();
      const tenant = await world.founder();
      const backoffice = await signedInBackoffice(world, admin.credentials);

      await backoffice.admin.loadUsers();
      await backoffice.admin.loadOrganizations();

      const state = backoffice.getState();
      expect(state.users.map((user) => user.email)).toEqual(
        expect.arrayContaining([
          admin.credentials.email,
          tenant.credentials.email,
        ]),
      );
      expect(state.organizations.map((entry) => entry.id)).toContain(
        tenant.organization.id,
      );
    },
  );

  it.concurrent(
    "shows an organization's members with their emails",
    async ({ world, expect }) => {
      const admin = await world.platformAdmin();
      const tenant = await world.founder();
      const backoffice = await signedInBackoffice(world, admin.credentials);

      await backoffice.admin.loadOrganizationDetail(tenant.organization.id);

      const detail = backoffice.getState().organizationDetail;
      expect(detail?.organization.id).toBe(tenant.organization.id);
      expect(detail?.members).toMatchObject([
        { role: "owner", email: tenant.credentials.email },
      ]);
      expect(detail?.sources).toEqual([]);
      expect(detail?.workspaces).toEqual([]);
      expect(detail?.workSessions).toEqual([]);
    },
  );

  it.concurrent(
    "sign-out resets the whole state",
    async ({ world, expect }) => {
      const admin = await world.platformAdmin();
      const backoffice = await signedInBackoffice(world, admin.credentials);
      await backoffice.admin.loadUsers();
      expect(backoffice.getState().users.length).toBeGreaterThan(0);

      await backoffice.auth.signOut();

      const state = backoffice.getState();
      expect(state.auth.status).toBe("anonymous");
      expect(state.users).toEqual([]);
      expect(state.organizations).toEqual([]);
      expect(state.organizationDetail).toBeNull();
    },
  );
});
