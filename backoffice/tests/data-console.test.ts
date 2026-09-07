import { afterAll, beforeAll, describe, it } from "vitest";

import { defaultTableQuery } from "../client/index.js";

import { createBackofficeConsoleWorld } from "./harness.js";
import type { BackofficeConsoleWorld } from "./harness.js";

let world: BackofficeConsoleWorld;
let organizationId = "";

beforeAll(async () => {
  world = await createBackofficeConsoleWorld({
    founder: "table-founder",
    tenantName: "Console Data Tenant",
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

describe("backoffice data console", () => {
  it.concurrent("loads the table catalog into state", async ({ expect }) => {
    const backoffice = await signedInBackoffice();
    await backoffice.data.loadTables();
    const { tables } = backoffice.getState();
    expect(tables.map((table) => table.name)).toContain("organizations");
    expect(tables.length).toBeGreaterThanOrEqual(14);
  });

  it.concurrent(
    "loads rows with the query that produced them",
    async ({ expect }) => {
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
      expect(tableData?.page.rows.map((row) => row.id)).toEqual([
        organizationId,
      ]);
    },
  );

  it.concurrent(
    "round-trips a modifier operator through the server",
    async ({ expect }) => {
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
    },
  );

  it.concurrent("mutations refresh the loaded page", async ({ expect }) => {
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

  it.concurrent(
    "leaves the loaded page alone when mutating another table",
    async ({ expect }) => {
      const backoffice = await signedInBackoffice();
      await backoffice.data.loadRows("organizations", defaultTableQuery);
      const before = backoffice.getState().tableData;

      // Named to stay out of the "-workspace"-suffix page the mutation story
      // filters on — these stories run concurrently over one database.
      await backoffice.data.insertRow("workspaces", {
        organizationId,
        name: "untracked-space",
      });
      expect(backoffice.getState().tableData).toBe(before);
    },
  );

  it.concurrent(
    "surfaces API failures as thrown ApiErrors",
    async ({ expect }) => {
      const backoffice = await signedInBackoffice();
      await expect(
        backoffice.data.loadRows("no_such_table", defaultTableQuery),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        backoffice.data.insertRow("organizations", { name: 5 }),
      ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    },
  );
});
