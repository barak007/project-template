import type {
  AdminOrganization,
  AdminUser,
  OrganizationDetail,
} from "./api.js";
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
  | { type: "users-loaded"; users: AdminUser[] }
  | { type: "organizations-loaded"; organizations: AdminOrganization[] }
  | { type: "organization-detail-loaded"; detail: OrganizationDetail };
