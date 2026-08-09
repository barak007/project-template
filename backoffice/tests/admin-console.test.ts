import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { browserFetch } from "../../domain-client/tests/kit/browser-fetch.js";
import type { Database } from "../../domain-server/db/client.js";
import {
  asUser,
  createTestDatabase,
  createTestUser,
  jsonBody,
} from "../../domain-server/tests/helpers/harness.js";
import {
  createBackofficeCore,
  createMemoryHistory,
  defaultTableQuery,
  textRowFilter,
} from "../client/index.js";

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

type Backoffice = ReturnType<typeof newBackofficeClient>;

/** The ids on the loaded table page, which admin mutations keep fresh. */
function loadedRowIds(backoffice: Backoffice): unknown[] {
  const { tableData } = backoffice.getState();
  return tableData?.page.rows.map((row) => row.id) ?? [];
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

  it("serves users and organizations through the table console", async () => {
    const backoffice = await signedInBackoffice();

    await backoffice.data.loadRows("user", defaultTableQuery);
    expect(loadedRowIds(backoffice)).toContain(founder);

    await backoffice.data.loadRows("organizations", defaultTableQuery);
    expect(loadedRowIds(backoffice)).toContain(organizationId);
  });

  it("filters users server-side with the shared filter syntax", async () => {
    const backoffice = await signedInBackoffice();
    const emailFilter = textRowFilter("email", `^${founder}@`);
    if (!emailFilter) throw new Error("filter did not parse");

    await backoffice.data.loadRows("user", {
      ...defaultTableQuery,
      filters: [emailFilter],
    });

    expect(loadedRowIds(backoffice)).toEqual([founder]);
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

  it("creates a user through the editor draft and deletes the row again", async () => {
    const backoffice = await signedInBackoffice();
    await backoffice.data.loadRows("user", defaultTableQuery);

    backoffice.admin.setUserDraft({ name: "Console User" });
    backoffice.admin.setUserDraft({
      email: "console-user@example.test",
      password: "console-password",
    });
    await backoffice.admin.createUser();

    const { userEditor, tableData } = backoffice.getState();
    expect(userEditor.error).toBeNull();
    // Success resets the draft for the next entry...
    expect(userEditor.draft).toEqual({ name: "", email: "", password: "" });
    // ...and refreshes the loaded user rows.
    const created = tableData?.page.rows.find(
      (row) => row.email === "console-user@example.test",
    );
    expect(created).toBeDefined();
    if (!created) throw new Error("user missing from loaded rows");

    await backoffice.data.deleteRow("user", { id: created.id ?? null });
    expect(loadedRowIds(backoffice)).not.toContain(created.id);
  });

  it("deletes an organization through the admin action, refreshing the rows", async () => {
    const backoffice = await signedInBackoffice();
    await backoffice.data.insertRow("organizations", { name: "Console Org" });

    await backoffice.data.loadRows("organizations", defaultTableQuery);
    const created = backoffice
      .getState()
      .tableData?.page.rows.find((row) => row.name === "Console Org");
    expect(created).toBeDefined();
    if (typeof created?.id !== "string")
      throw new Error("organization missing from loaded rows");

    await backoffice.admin.deleteOrganization(created.id);
    expect(loadedRowIds(backoffice)).not.toContain(created.id);
  });

  it("keeps a conflict as editor state, never thrown", async () => {
    const backoffice = await signedInBackoffice();

    backoffice.admin.setUserDraft({
      name: "Duplicate Founder",
      email: `${founder}@example.test`,
      password: "console-password",
    });
    await backoffice.admin.createUser();

    const { userEditor } = backoffice.getState();
    expect(userEditor.error).toMatchObject({ code: "CONFLICT" });
    // The draft survives so the operator can correct it.
    expect(userEditor.draft.email).toBe(`${founder}@example.test`);

    // Reopening the editor starts clean.
    backoffice.admin.resetUserEditor();
    const reset = backoffice.getState().userEditor;
    expect(reset.error).toBeNull();
    expect(reset.draft).toEqual({ name: "", email: "", password: "" });
  });

  it("loads a user's detail with memberships", async () => {
    const backoffice = await signedInBackoffice();

    await backoffice.admin.loadUserDetail(founder);

    const detail = backoffice.getState().userDetail;
    expect(detail?.user.id).toBe(founder);
    expect(detail?.memberships).toMatchObject([
      { organizationId, organizationName: "Console Tenant", role: "owner" },
    ]);
  });

  it("sign-out resets the whole state", async () => {
    const backoffice = await signedInBackoffice();
    await backoffice.data.loadRows("user", defaultTableQuery);
    expect(loadedRowIds(backoffice).length).toBeGreaterThan(0);

    await backoffice.auth.signOut();

    const state = backoffice.getState();
    expect(state.auth.status).toBe("anonymous");
    expect(state.tableData).toBeNull();
    expect(state.organizationDetail).toBeNull();
  });
});
