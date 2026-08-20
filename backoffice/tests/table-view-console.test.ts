import { afterAll, beforeAll, describe, it } from "vitest";

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
import type { RowFilter } from "../client/index.js";

import {
  backofficeAdminCredentials,
  createBackofficeTestApp,
} from "./harness.js";

const baseUrl = "http://backoffice.test";

let db: Database;
let close: () => Promise<void>;
let app: ReturnType<typeof createBackofficeTestApp>["app"];

const founder = "table-view-founder";
let organizationId = "";

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  ({ app } = createBackofficeTestApp(db));
  await createTestUser(db, founder);
  const created = await app.request(
    "/api/organizations",
    asUser(founder, jsonBody({ name: "Table View Tenant" })),
  );
  organizationId = ((await created.json()) as { id: string }).id;
});

afterAll(async () => {
  await close();
});

/** One signed-in admin browser with its own history and table catalog. */
async function openedConsole(initialPath = "/") {
  const history = createMemoryHistory(initialPath);
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
    history,
  });
  await backoffice.auth.signIn(backofficeAdminCredentials);
  if (backoffice.getState().auth.status !== "authenticated")
    throw new Error("Backoffice sign-in failed");
  await backoffice.data.loadTables();
  return { backoffice, history };
}

const nameFilter: RowFilter[] = [{ column: "name", op: "eq", value: "linked" }];

describe("backoffice table view", () => {
  it.concurrent("boots with the default route's view", async ({ expect }) => {
    const { backoffice } = await openedConsole();
    expect(backoffice.getState().tableView).toEqual({
      table: "user",
      routeFilters: [],
      query: defaultTableQuery,
      drafts: {},
      editor: null,
      error: null,
    });
  });

  it.concurrent(
    "opening another table starts a fresh view and drops drafts",
    async ({ expect }) => {
      const { backoffice } = await openedConsole();
      backoffice.view.setDraft("email", "^admin");
      backoffice.navigation.navigate({ kind: "table", table: "workspaces" });
      expect(backoffice.getState().tableView).toEqual({
        table: "workspaces",
        routeFilters: [],
        query: defaultTableQuery,
        drafts: {},
        editor: null,
        error: null,
      });
    },
  );

  it.concurrent(
    "a followed foreign-key link seeds the query with the route's filters",
    async ({ expect }) => {
      const { backoffice } = await openedConsole();
      backoffice.navigation.navigate({
        kind: "table",
        table: "workspaces",
        filters: nameFilter,
      });
      const view = backoffice.getState().tableView;
      expect(view?.routeFilters).toEqual(nameFilter);
      expect(view?.query.filters).toEqual(nameFilter);

      // The same link again is idempotent: the view survives untouched.
      backoffice.view.setDraft("name", "draft");
      const edited = backoffice.getState().tableView;
      backoffice.navigation.navigate({
        kind: "table",
        table: "workspaces",
        filters: nameFilter,
      });
      expect(backoffice.getState().tableView).toBe(edited);
    },
  );

  it.concurrent(
    "draft edits become row filters and return to the first page",
    async ({ expect }) => {
      const { backoffice } = await openedConsole();
      backoffice.navigation.navigate({ kind: "table", table: "organizations" });
      backoffice.view.nextPage();
      backoffice.view.setDraft("name", "^acme");
      backoffice.view.setDraft("createdAt:from", "2026-01-01");
      backoffice.view.applyFilters();
      const view = backoffice.getState().tableView;
      expect(view?.query.filters).toEqual([
        { column: "name", op: "starts-with", value: "acme" },
        { column: "createdAt", op: "gte", value: "2026-01-01" },
      ]);
      expect(view?.query.offset).toBe(0);
    },
  );

  it.concurrent(
    "applying untouched drafts never wipes the route's filters",
    async ({ expect }) => {
      const { backoffice } = await openedConsole();
      backoffice.navigation.navigate({
        kind: "table",
        table: "workspaces",
        filters: nameFilter,
      });
      backoffice.view.applyFilters();
      expect(backoffice.getState().tableView?.query.filters).toEqual(
        nameFilter,
      );
    },
  );

  it.concurrent(
    "sorting flips direction on repeat and skips redacted columns",
    async ({ expect }) => {
      const { backoffice } = await openedConsole();
      backoffice.view.toggleSort("email");
      expect(backoffice.getState().tableView?.query).toMatchObject({
        sort: "email",
        dir: "asc",
      });
      backoffice.view.toggleSort("email");
      expect(backoffice.getState().tableView?.query.dir).toBe("desc");
      backoffice.view.toggleSort("name");
      expect(backoffice.getState().tableView?.query).toMatchObject({
        sort: "name",
        dir: "asc",
      });

      // account.password is redacted secret material — not sortable.
      backoffice.navigation.navigate({ kind: "table", table: "account" });
      backoffice.view.toggleSort("password");
      expect(backoffice.getState().tableView?.query.sort).toBeUndefined();
    },
  );

  it.concurrent(
    "page turns move the offset, clamp at the start, and mirror the URL",
    async ({ expect }) => {
      const { backoffice, history } = await openedConsole();
      backoffice.navigation.navigate({ kind: "table", table: "organizations" });
      backoffice.view.setDraft("name", "acme");

      backoffice.view.nextPage();
      expect(backoffice.getState().tableView?.query.offset).toBe(50);
      expect(history.path()).toBe("/tables/organizations?offset=50");
      // The mirrored route loops back through navigation without resetting
      // the view: the draft survives the page turn.
      expect(backoffice.getState().tableView?.drafts).toEqual({
        name: "acme",
      });

      backoffice.view.previousPage();
      backoffice.view.previousPage();
      expect(backoffice.getState().tableView?.query.offset).toBe(0);
      expect(history.path()).toBe("/tables/organizations");

      backoffice.view.setLimit(100);
      expect(backoffice.getState().tableView?.query).toMatchObject({
        limit: 100,
        offset: 0,
      });
      expect(history.path()).toBe("/tables/organizations?limit=100");
    },
  );

  it.concurrent(
    "clearing filters drops drafts, filters, and the route's filters",
    async ({ expect }) => {
      const { backoffice, history } = await openedConsole();
      backoffice.navigation.navigate({
        kind: "table",
        table: "workspaces",
        filters: nameFilter,
      });
      backoffice.view.setDraft("name", "acme");
      backoffice.view.clearFilters();
      expect(backoffice.getState().tableView).toEqual({
        table: "workspaces",
        routeFilters: [],
        query: defaultTableQuery,
        drafts: {},
        editor: null,
        error: null,
      });
      expect(history.path()).toBe("/tables/workspaces");
    },
  );

  it.concurrent(
    "a deep link's pagination lands in the query",
    async ({ expect }) => {
      const { backoffice } = await openedConsole(
        "/tables/organizations?limit=100&offset=200",
      );
      expect(backoffice.getState().tableView?.query).toMatchObject({
        limit: 100,
        offset: 200,
      });
    },
  );

  it.concurrent(
    "the row editor opens and closes in the view",
    async ({ expect }) => {
      const { backoffice } = await openedConsole();
      backoffice.view.openEditor({ mode: "insert" });
      expect(backoffice.getState().tableView?.editor).toEqual({
        mode: "insert",
      });
      backoffice.view.closeEditor();
      expect(backoffice.getState().tableView?.editor).toBeNull();
    },
  );

  it.concurrent(
    "mutation failures land in state and the next attempt clears them",
    async ({ expect }) => {
      const { backoffice } = await openedConsole();
      const failed = await backoffice.view.mutate(() =>
        backoffice.data.insertRow("organizations", { name: 5 }),
      );
      expect(failed).toBe(false);
      expect(backoffice.getState().tableView?.error?.code).toBe(
        "VALIDATION_FAILED",
      );

      const saved = await backoffice.view.mutate(() =>
        backoffice.data.insertRow("workspaces", {
          organizationId,
          name: `ops-${crypto.randomUUID()}`,
        }),
      );
      expect(saved).toBe(true);
      expect(backoffice.getState().tableView?.error).toBeNull();
    },
  );

  it.concurrent(
    "opening another table closes the editor and drops the error",
    async ({ expect }) => {
      const { backoffice } = await openedConsole();
      backoffice.view.openEditor({ mode: "insert" });
      await backoffice.view.mutate(() =>
        backoffice.data.insertRow("organizations", { name: 5 }),
      );
      backoffice.navigation.navigate({ kind: "table", table: "workspaces" });
      const view = backoffice.getState().tableView;
      expect(view?.editor).toBeNull();
      expect(view?.error).toBeNull();
    },
  );

  it.concurrent(
    "signing out rebuilds the view for the route it stays on",
    async ({ expect }) => {
      const { backoffice } = await openedConsole();
      backoffice.navigation.navigate({
        kind: "table",
        table: "workspaces",
        filters: nameFilter,
      });
      backoffice.view.setDraft("name", "acme");
      await backoffice.auth.signOut();
      expect(backoffice.getState().tableView).toEqual({
        table: "workspaces",
        routeFilters: nameFilter,
        query: { ...defaultTableQuery, filters: nameFilter },
        drafts: {},
        editor: null,
        error: null,
      });
    },
  );
});
