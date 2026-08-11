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
} from "../client/index.js";

import {
  backofficeAdminCredentials,
  createBackofficeTestApp,
} from "./harness.js";

const baseUrl = "http://backoffice.test";

let db: Database;
let close: () => Promise<void>;
let app: ReturnType<typeof createBackofficeTestApp>["app"];

const founder = "table-founder";
let organizationId = "";

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  ({ app } = createBackofficeTestApp(db));
  await createTestUser(db, founder);
  const created = await app.request(
    "/api/organizations",
    asUser(founder, jsonBody({ name: "Console Data Tenant" })),
  );
  expect(created.status).toBe(201);
  organizationId = ((await created.json()) as { id: string }).id;
});

afterAll(async () => {
  await close();
});

async function signedInBackoffice() {
  const backoffice = createBackofficeCore({
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
  await backoffice.auth.signIn(backofficeAdminCredentials);
  if (backoffice.getState().auth.status !== "authenticated")
    throw new Error("Backoffice sign-in failed");
  return backoffice;
}

describe("backoffice data console", () => {
  it("loads the table catalog into state", async () => {
    const backoffice = await signedInBackoffice();
    await backoffice.data.loadTables();
    const { tables } = backoffice.getState();
    expect(tables.map((table) => table.name)).toContain("organizations");
    expect(tables.length).toBeGreaterThanOrEqual(14);
  });

  it("loads rows with the query that produced them", async () => {
    const backoffice = await signedInBackoffice();
    const query = {
      ...defaultTableQuery,
      sort: "name",
      dir: "asc" as const,
      filters: [
        { column: "name", op: "contains" as const, value: "Console Data" },
      ],
    };
    await backoffice.data.loadRows("organizations", query);
    const { tableData } = backoffice.getState();
    expect(tableData?.table).toBe("organizations");
    expect(tableData?.query).toEqual(query);
    expect(tableData?.page.rows.map((row) => row.id)).toEqual([organizationId]);
  });

  it("round-trips a modifier operator through the server", async () => {
    const backoffice = await signedInBackoffice();
    await backoffice.data.loadRows("organizations", {
      ...defaultTableQuery,
      filters: [{ column: "name", op: "starts-with", value: "console data" }],
    });
    expect(
      backoffice.getState().tableData?.page.rows.map((row) => row.id),
    ).toEqual([organizationId]);

    await backoffice.data.loadRows("organizations", {
      ...defaultTableQuery,
      filters: [{ column: "name", op: "not-contains", value: "console" }],
    });
    expect(backoffice.getState().tableData?.page.total).toBe(0);
  });

  it("mutations refresh the loaded page", async () => {
    const backoffice = await signedInBackoffice();
    // The organization's own workspace shares the table, so this page is
    // filtered down to the rows this story creates.
    const ownRows = {
      ...defaultTableQuery,
      filters: [
        { column: "name", op: "ends-with" as const, value: "-workspace" },
      ],
    };
    await backoffice.data.loadRows("workspaces", ownRows);
    expect(backoffice.getState().tableData?.page.total).toBe(0);

    await backoffice.data.insertRow("workspaces", {
      organizationId,
      name: "ops-workspace",
    });
    const inserted = backoffice.getState().tableData?.page;
    expect(inserted?.total).toBe(1);
    const workspaceId = inserted?.rows[0]?.id as string;

    await backoffice.data.updateRow(
      "workspaces",
      { id: workspaceId },
      { name: "renamed-workspace" },
    );
    expect(backoffice.getState().tableData?.page.rows[0]?.name).toBe(
      "renamed-workspace",
    );

    await backoffice.data.deleteRow("workspaces", { id: workspaceId });
    expect(backoffice.getState().tableData?.page.total).toBe(0);
  });

  it("leaves the loaded page alone when mutating another table", async () => {
    const backoffice = await signedInBackoffice();
    await backoffice.data.loadRows("organizations", defaultTableQuery);
    const before = backoffice.getState().tableData;

    await backoffice.data.insertRow("workspaces", {
      organizationId,
      name: "untracked-workspace",
    });
    expect(backoffice.getState().tableData).toBe(before);
  });

  it("surfaces API failures as thrown ApiErrors", async () => {
    const backoffice = await signedInBackoffice();
    await expect(
      backoffice.data.loadRows("no_such_table", defaultTableQuery),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      backoffice.data.insertRow("organizations", { name: 5 }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });
});
