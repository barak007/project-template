import type {
  AdminOrganization,
  AdminUser,
  OrganizationDetail,
} from "./api.js";

export type AdminEvent =
  | { type: "reset" }
  | { type: "users-loaded"; users: AdminUser[] }
  | { type: "organizations-loaded"; organizations: AdminOrganization[] }
  | { type: "organization-detail-loaded"; detail: OrganizationDetail };
