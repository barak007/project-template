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
import type { AuthError, AuthUser, ProjectTarget } from "./state.js";

/**
 * Everything that can happen to the client, as facts. Actions call the API
 * and dispatch these; the projection folds them into state. Events scoped to
 * an organization carry its id — the projection uses it to keep state on one
 * organization at a time.
 */
export type ClientEvent =
  | { type: "signed-in"; user: AuthUser }
  | { type: "sign-in-failed"; error: AuthError }
  | { type: "signed-out" }
  | { type: "organizations-loaded"; organizations: Organization[] }
  | { type: "organization-created"; organization: Organization }
  | { type: "members-loaded"; organizationId: string; members: Membership[] }
  | { type: "membership-put"; organizationId: string; membership: Membership }
  | { type: "repository-added"; organizationId: string; source: Source }
  | { type: "sources-loaded"; organizationId: string; sources: Source[] }
  | { type: "source-created"; organizationId: string; source: Source }
  | { type: "source-updated"; organizationId: string; source: Source }
  | { type: "source-deleted"; organizationId: string; sourceId: string }
  | {
      type: "workspaces-loaded";
      organizationId: string;
      workspaces: Workspace[];
    }
  | { type: "workspace-created"; organizationId: string; workspace: Workspace }
  | { type: "workspace-updated"; organizationId: string; workspace: Workspace }
  | { type: "workspace-deleted"; organizationId: string; workspaceId: string }
  | {
      type: "work-sessions-loaded";
      organizationId: string;
      workSessions: WorkSession[];
    }
  | {
      type: "work-session-started";
      organizationId: string;
      workSession: WorkSession;
    }
  | {
      type: "work-session-refreshed";
      organizationId: string;
      workSession: WorkSession;
    }
  | {
      type: "project-directory-loaded";
      organizationId: string;
      target: ProjectTarget;
      path: string;
      entries: ProjectEntry[];
    }
  /** Closing a folder: what was read about it is forgotten, not hidden. */
  | { type: "project-directory-collapsed"; path: string }
  | {
      type: "project-file-loaded";
      organizationId: string;
      target: ProjectTarget;
      file: ProjectFile;
    }
  | {
      type: "organization-secrets-loaded";
      organizationId: string;
      secrets: Secret[];
    }
  | { type: "organization-secret-put"; organizationId: string; secret: Secret }
  | { type: "organization-secret-deleted"; organizationId: string; key: string }
  | {
      type: "organization-data-loaded";
      organizationId: string;
      data: DataEntry[];
    }
  | { type: "organization-data-put"; organizationId: string; entry: DataEntry }
  | { type: "user-secrets-loaded"; secrets: Secret[] }
  | { type: "user-secret-put"; secret: Secret }
  | { type: "user-secret-deleted"; key: string }
  | { type: "user-data-loaded"; data: DataEntry[] }
  | { type: "user-data-put"; entry: DataEntry };
