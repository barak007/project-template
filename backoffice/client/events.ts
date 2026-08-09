import type {
  AdminOrganization,
  AdminUser,
  OrganizationDetail,
  RowsPage,
  TableMeta,
  UserDetail,
} from "./api.js";
import type { TableQuery } from "./data-actions.js";
import type { Route } from "./router.js";
import type {
  BackofficeAuthError,
  BackofficeError,
  UserDraft,
} from "./state.js";

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
  | { type: "users-filter-set"; filter: string }
  | { type: "user-editor-toggled"; open: boolean }
  | { type: "user-draft-set"; draft: Partial<UserDraft> }
  | { type: "user-mutation-failed"; error: BackofficeError }
  | { type: "user-detail-loaded"; detail: UserDetail }
  | { type: "organizations-loaded"; organizations: AdminOrganization[] }
  | { type: "organizations-filter-set"; filter: string }
  | { type: "organization-draft-set"; name: string }
  | { type: "organization-mutation-failed"; error: BackofficeError }
  | { type: "organization-detail-loaded"; detail: OrganizationDetail }
  | { type: "tables-loaded"; tables: TableMeta[] }
  | {
      type: "table-rows-loaded";
      table: string;
      query: TableQuery;
      page: RowsPage;
    };
