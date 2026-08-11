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
 * Which git project is being browsed: a **workspace's** own project — the
 * template its repositories live in as submodules — or a **session's** clone of
 * it. The two are read through the same actions, so which one it is travels as
 * a value rather than as two slices.
 */
export type ProjectTarget = { kind: "workspace" | "session"; id: string };

/**
 * One project as it has been browsed so far: the directories that have been
 * opened, keyed by path (`""` is the root), and the file being read. A tree is
 * expanded a level at a time, so an unopened folder is simply absent — which is
 * also what "collapsed" means.
 */
export type ProjectFilesState = {
  target: ProjectTarget | null;
  directories: Record<string, ProjectEntry[]>;
  openFile: ProjectFile | null;
};

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
  projectFiles: ProjectFilesState;
  organizationSecrets: Secret[];
  organizationData: DataEntry[];
};

export const emptyProjectFiles: ProjectFilesState = {
  target: null,
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
  projectFiles: emptyProjectFiles,
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
