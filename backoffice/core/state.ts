import type {
  AdminOrganization,
  AdminUser,
  OrganizationDetail,
} from "./api.js";

export type BackofficeAuthError = { code: string; message: string };

/**
 * The backoffice admin is a standalone credential configured on the server —
 * not an application user — so auth starts "unknown" until the status
 * endpoint says whether the credential exists ("needs-setup" when it does
 * not) and whether this browser already holds a session.
 */
export type BackofficeAuthState =
  | { status: "unknown" }
  | { status: "needs-setup"; error?: BackofficeAuthError }
  | { status: "anonymous"; error?: BackofficeAuthError }
  | { status: "authenticated"; email: string };

export type AdminState = {
  users: AdminUser[];
  organizations: AdminOrganization[];
  organizationDetail: OrganizationDetail | null;
};

export type BackofficeState = AdminState & { auth: BackofficeAuthState };

export const initialAdminState: AdminState = {
  users: [],
  organizations: [],
  organizationDetail: null,
};

export const initialBackofficeState: BackofficeState = {
  ...initialAdminState,
  auth: { status: "unknown" },
};
