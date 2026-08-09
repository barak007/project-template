import type {
  AdminOrganization,
  AdminUser,
  OrganizationDetail,
  RowsPage,
  TableMeta,
  UserDetail,
} from "./api.js";
import type { TableQuery } from "./data-actions.js";
import { defaultRoute } from "./router.js";
import type { Route } from "./router.js";

export type BackofficeError = { code: string; message: string };
export type BackofficeAuthError = BackofficeError;

export type UserDraft = { name: string; email: string; password: string };

export const emptyUserDraft: UserDraft = { name: "", email: "", password: "" };

/** Everything the users page shows or edits — no state lives in the UI. */
export type UsersPageState = {
  filter: string;
  editorOpen: boolean;
  draft: UserDraft;
  error: BackofficeError | null;
};

export type OrganizationsPageState = {
  filter: string;
  draftName: string;
  error: BackofficeError | null;
};

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

/** The one loaded table page, remembered with the query that produced it. */
export type TableDataState = {
  table: string;
  query: TableQuery;
  page: RowsPage;
} | null;

export type AdminState = {
  users: AdminUser[];
  usersPage: UsersPageState;
  userDetail: UserDetail | null;
  organizations: AdminOrganization[];
  organizationsPage: OrganizationsPageState;
  organizationDetail: OrganizationDetail | null;
  tables: TableMeta[];
  tableData: TableDataState;
};

export type BackofficeState = AdminState & {
  auth: BackofficeAuthState;
  route: Route;
};

export const initialAdminState: AdminState = {
  users: [],
  usersPage: {
    filter: "",
    editorOpen: false,
    draft: emptyUserDraft,
    error: null,
  },
  userDetail: null,
  organizations: [],
  organizationsPage: { filter: "", draftName: "", error: null },
  organizationDetail: null,
  tables: [],
  tableData: null,
};

export const initialBackofficeState: BackofficeState = {
  ...initialAdminState,
  auth: { status: "unknown" },
  route: defaultRoute,
};
