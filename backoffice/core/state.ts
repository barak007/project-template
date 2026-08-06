import type { AuthState } from "../../client/src/index.js";

import type {
  AdminOrganization,
  AdminUser,
  OrganizationDetail,
} from "./api.js";

/** The slices owned by the backoffice; auth belongs to the client core. */
export type AdminState = {
  users: AdminUser[];
  organizations: AdminOrganization[];
  organizationDetail: OrganizationDetail | null;
};

export type BackofficeState = AdminState & { auth: AuthState };

export const initialAdminState: AdminState = {
  users: [],
  organizations: [],
  organizationDetail: null,
};
