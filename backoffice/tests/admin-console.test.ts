import { afterAll, beforeAll, describe, it } from "vitest";

import { defaultTableQuery, textRowFilter } from "../client/index.js";

import {
  backofficeAdminCredentials,
  createBackofficeConsoleWorld,
} from "./harness.js";
import type { BackofficeConsole, BackofficeConsoleWorld } from "./harness.js";

const founder = "console-founder";

let world: BackofficeConsoleWorld;
let organizationId = "";

beforeAll(async () => {
  world = await createBackofficeConsoleWorld({
    founder,
    tenantName: "Console Tenant",
  });
  ({ organizationId } = world);
});

afterAll(async () => {
  await world.close();
});

async function signedInBackoffice() {
  const { backoffice } = await world.signedInConsole();
  return backoffice;
}

/** The ids on the loaded table page, which admin mutations keep fresh. */
function loadedRowIds(backoffice: BackofficeConsole): unknown[] {
  const { tableData } = backoffice.getState();
  return tableData?.page.rows.map((row) => row.id) ?? [];
}

describe("backoffice admin console", () => {
  it.concurrent(
    "resolves boot status to anonymous when configured",
    async ({ expect }) => {
      const { backoffice } = world.newConsole();
      expect(backoffice.getState().auth.status).toBe("unknown");
      await backoffice.auth.loadStatus();
      expect(backoffice.getState().auth.status).toBe("anonymous");
    },
  );

  it.concurrent(
    "keeps sign-in failures as state, never thrown",
    async ({ expect }) => {
      const { backoffice } = world.newConsole();
      await backoffice.auth.signIn({
        email: backofficeAdminCredentials.email,
        password: "wrong-password",
      });
      const { auth } = backoffice.getState();
      expect(auth.status).toBe("anonymous");
      if (auth.status === "anonymous") expect(auth.error).toBeDefined();
    },
  );

  it.concurrent(
    "serves users and organizations through the table console",
    async ({ expect }) => {
      const backoffice = await signedInBackoffice();

      await backoffice.data.loadRows("user", defaultTableQuery);
      expect(loadedRowIds(backoffice)).toContain(founder);

      await backoffice.data.loadRows("organizations", defaultTableQuery);
      expect(loadedRowIds(backoffice)).toContain(organizationId);
    },
  );

  it.concurrent(
    "filters users server-side with the shared filter syntax",
    async ({ expect }) => {
      const backoffice = await signedInBackoffice();
      const emailFilter = textRowFilter("email", `^${founder}@`);
      if (!emailFilter) throw new Error("filter did not parse");

      await backoffice.data.loadRows("user", {
        ...defaultTableQuery,
        filters: [emailFilter],
      });

      expect(loadedRowIds(backoffice)).toEqual([founder]);
    },
  );

  it.concurrent(
    "shows an organization's members with their emails",
    async ({ expect }) => {
      const backoffice = await signedInBackoffice();

      await backoffice.admin.loadOrganizationDetail(organizationId);

      const detail = backoffice.getState().organizationDetail;
      expect(detail?.organization.id).toBe(organizationId);
      expect(detail?.members).toMatchObject([
        { role: "owner", email: `${founder}@example.test` },
      ]);
    },
  );

  it.concurrent(
    "creates a user through the editor draft and deletes the row again",
    async ({ expect }) => {
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
    },
  );

  it.concurrent(
    "deletes an organization through the admin action, refreshing the rows",
    async ({ expect }) => {
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
    },
  );

  it.concurrent(
    "keeps a conflict as editor state, never thrown",
    async ({ expect }) => {
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
    },
  );

  it.concurrent(
    "loads a user's detail with memberships",
    async ({ expect }) => {
      const backoffice = await signedInBackoffice();

      await backoffice.admin.loadUserDetail(founder);

      const detail = backoffice.getState().userDetail;
      expect(detail?.user.id).toBe(founder);
      expect(detail?.memberships).toMatchObject([
        { organizationId, organizationName: "Console Tenant", role: "owner" },
      ]);
    },
  );

  it.concurrent("sign-out resets the whole state", async ({ expect }) => {
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
