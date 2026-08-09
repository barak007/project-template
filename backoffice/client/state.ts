import type {
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

/**
 * The create-user editor — the one users-table affordance the generic row
 * editor cannot provide, because it writes a password credential alongside
 * the user row. Everything it shows or edits lives here, not in the UI.
 */
export type UserEditorState = {
  draft: UserDraft;
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
  userEditor: UserEditorState;
  userDetail: UserDetail | null;
  organizationDetail: OrganizationDetail | null;
  tables: TableMeta[];
  tableData: TableDataState;
};

export type BackofficeState = AdminState & {
  auth: BackofficeAuthState;
  route: Route;
};

export const initialAdminState: AdminState = {
  userEditor: { draft: emptyUserDraft, error: null },
  userDetail: null,
  organizationDetail: null,
  tables: [],
  tableData: null,
};

export const initialBackofficeState: BackofficeState = {
  ...initialAdminState,
  auth: { status: "unknown" },
  route: defaultRoute,
};
