import type {
  DataEntry,
  Membership,
  Organization,
  ProjectEntry,
  ProjectFile,
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
/**
 * One session's project as it has been browsed so far: the directories that
 * have been opened, keyed by path (`""` is the root), and the file being read.
 * A tree is expanded a level at a time, so an unopened folder is simply absent
 * — which is also what "collapsed" means.
 */
export type SessionFilesState = {
  workSessionId: string | null;
  directories: Record<string, ProjectEntry[]>;
  openFile: ProjectFile | null;
};

export type OrganizationSlices = {
  currentOrganizationId: string | null;
  members: Membership[];
  /** Repositories are `git` sources; there is no separate collection. */
  sources: Source[];
  workspaces: Workspace[];
  workSessions: WorkSession[];
  sessionFiles: SessionFilesState;
  organizationSecrets: Secret[];
  organizationData: DataEntry[];
};

export const emptySessionFiles: SessionFilesState = {
  workSessionId: null,
  directories: {},
  openFile: null,
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
  sessionFiles: emptySessionFiles,
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
