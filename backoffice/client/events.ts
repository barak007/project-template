import type {
  AdminOrganization,
  AdminUser,
  OrganizationDetail,
  RowsPage,
  TableMeta,
} from "./api.js";
import type { TableQuery } from "./data-actions.js";
import type { Route } from "./router.js";
import type { BackofficeAuthError } from "./state.js";

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
  | { type: "users-loaded"; users: AdminUser[] }
  | { type: "organizations-loaded"; organizations: AdminOrganization[] }
  | { type: "organization-detail-loaded"; detail: OrganizationDetail }
  | { type: "tables-loaded"; tables: TableMeta[] }
  | {
      type: "table-rows-loaded";
      table: string;
      query: TableQuery;
      page: RowsPage;
    };
