import type {
  DataEntry,
  Membership,
  Organization,
  Secret,
  Source,
  WorkSession,
  Workspace,
} from "./api.js";

export type AuthUser = { id: string; name: string; email: string };
export type AuthError = { code: string; message: string };

export type AuthState =
  | { status: "anonymous"; error?: AuthError }
  | { status: "authenticated"; user: AuthUser };

/**
 * Collections scoped to the organization the user is currently working in —
 * state mirrors a UI showing one organization at a time, so acting on a
 * different organization resets these (see projection.ts).
 */
export type OrganizationSlices = {
  currentOrganizationId: string | null;
  members: Membership[];
  /** Repositories are `git` sources; there is no separate collection. */
  sources: Source[];
  workspaces: Workspace[];
  workSessions: WorkSession[];
  organizationSecrets: Secret[];
  organizationData: DataEntry[];
};

export type ClientState = OrganizationSlices & {
  auth: AuthState;
  organizations: Organization[];
  userSecrets: Secret[];
  userData: DataEntry[];
};

export const emptyOrganizationSlices: OrganizationSlices = {
  currentOrganizationId: null,
  members: [],
  sources: [],
  workspaces: [],
  workSessions: [],
  organizationSecrets: [],
  organizationData: [],
};

export const initialState: ClientState = {
  ...emptyOrganizationSlices,
  auth: { status: "anonymous" },
  organizations: [],
  userSecrets: [],
  userData: [],
};
