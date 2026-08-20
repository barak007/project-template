import type { RowFilter } from "../server/entities/data.js";

import type {
  OrganizationDetail,
  RowsPage,
  TableMeta,
  UserDetail,
} from "./api.js";
import type { Route } from "./router.js";
import type {
  BackofficeAuthError,
  BackofficeError,
  UserDraft,
} from "./state.js";
import type { TableQuery } from "./table-view.js";

export type BackofficeEvent =
  | {
      type: "auth-status-loaded";
      configured: boolean;
      authenticated: boolean;
      email?: string;
    }
  | { type: "signed-in"; email: string }
  | { type: "auth-failed"; error: BackofficeAuthError }
  | { type: "signed-out" }
  | { type: "navigated"; route: Route }
  | { type: "user-draft-set"; draft: Partial<UserDraft> }
  | { type: "user-editor-reset" }
  | { type: "user-mutation-failed"; error: BackofficeError }
  | { type: "user-detail-loaded"; detail: UserDetail }
  | { type: "organization-detail-loaded"; detail: OrganizationDetail }
  | { type: "tables-loaded"; tables: TableMeta[] }
  | {
      type: "table-rows-loaded";
      table: string;
      query: TableQuery;
      page: RowsPage;
    }
  | { type: "table-draft-set"; key: string; value: string }
  | { type: "table-filters-applied"; filters: RowFilter[] }
  | { type: "table-filters-cleared" }
  | { type: "table-sorted"; column: string }
  | { type: "table-limit-set"; limit: number }
  | { type: "table-page-turned"; direction: "next" | "previous" };
