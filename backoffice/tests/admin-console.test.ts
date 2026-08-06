import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { browserFetch } from "../../client/tests/kit/browser-fetch.js";
import type { Database } from "../../domain-server/db/client.js";
import {
  asUser,
  createTestDatabase,
  createTestUser,
  jsonBody,
} from "../../domain-server/tests/helpers/harness.js";
import { createBackofficeCore, createMemoryHistory } from "../client/index.js";

import {
  backofficeAdminCredentials,
  createBackofficeTestApp,
} from "./harness.js";

const baseUrl = "http://backoffice.test";

let db: Database;
let close: () => Promise<void>;
let app: ReturnType<typeof createBackofficeTestApp>["app"];

const founder = "console-founder";
let organizationId = "";

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  ({ app } = createBackofficeTestApp(db));
  await createTestUser(db, founder);
  const created = await app.request(
    "/api/organizations",
    asUser(founder, jsonBody({ name: "Console Tenant" })),
  );
  expect(created.status).toBe(201);
  organizationId = ((await created.json()) as { id: string }).id;
});

afterAll(async () => {
  await close();
});

/** Each client is an independent "browser": its own core and cookie jar. */
function newBackofficeClient() {
  return createBackofficeCore({
    baseUrl,
    host: {
      fetch: browserFetch(async (input, init) =>
        app.request(
          input instanceof Request ? input : new URL(input, baseUrl),
          init,
        ),
      ),
    },
    history: createMemoryHistory(),
  });
}

async function signedInBackoffice() {
  const backoffice = newBackofficeClient();
  await backoffice.auth.signIn(backofficeAdminCredentials);
  if (backoffice.getState().auth.status !== "authenticated")
    throw new Error("Backoffice sign-in failed");
  return backoffice;
}

describe("backoffice admin console", () => {
  it("resolves boot status to anonymous when configured", async () => {
    const backoffice = newBackofficeClient();
    expect(backoffice.getState().auth.status).toBe("unknown");
    await backoffice.auth.loadStatus();
    expect(backoffice.getState().auth.status).toBe("anonymous");
  });

  it("keeps sign-in failures as state, never thrown", async () => {
    const backoffice = newBackofficeClient();
    await backoffice.auth.signIn({
      email: backofficeAdminCredentials.email,
      password: "wrong-password",
    });
    const { auth } = backoffice.getState();
    expect(auth.status).toBe("anonymous");
    if (auth.status === "anonymous") expect(auth.error).toBeDefined();
  });

  it("shows the backoffice admin every user and organization", async () => {
    const backoffice = await signedInBackoffice();

    await backoffice.admin.loadUsers();
    await backoffice.admin.loadOrganizations();

    const state = backoffice.getState();
    expect(state.users.map((entry) => entry.id)).toContain(founder);
    expect(state.organizations.map((entry) => entry.id)).toContain(
      organizationId,
    );
  });

  it("shows an organization's members with their emails", async () => {
    const backoffice = await signedInBackoffice();

    await backoffice.admin.loadOrganizationDetail(organizationId);

    const detail = backoffice.getState().organizationDetail;
    expect(detail?.organization.id).toBe(organizationId);
    expect(detail?.members).toMatchObject([
      { role: "owner", email: `${founder}@example.test` },
    ]);
  });

  it("sign-out resets the whole state", async () => {
    const backoffice = await signedInBackoffice();
    await backoffice.admin.loadUsers();
    expect(backoffice.getState().users.length).toBeGreaterThan(0);

    await backoffice.auth.signOut();

    const state = backoffice.getState();
    expect(state.auth.status).toBe("anonymous");
    expect(state.users).toEqual([]);
    expect(state.organizations).toEqual([]);
    expect(state.organizationDetail).toBeNull();
  });
});
