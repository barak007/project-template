import { readJson } from "./api.js";
import type { Api, ProjectEntry, ProjectFile } from "./api.js";
import { toApiError } from "./errors.js";
import type { ClientStore } from "./projection.js";
import type { ProjectTarget } from "./state.js";

/**
 * The files of a git project, read through the API a directory and a file at a
 * time. Two projects can be browsed the same way, which is why the target is a
 * value: a **workspace's** project — the template holding its repositories as
 * submodules — and a **session's** clone of it.
 *
 * Nothing here touches a filesystem: the project can live on a machine the
 * person browsing has no access to, which is the whole reason the server does
 * the reading.
 */
export function createProjectFileActions(api: Api, store: ClientStore) {
  const organizations = api.api.organizations[":organizationId"];

  const listRequest = (
    organizationId: string,
    target: ProjectTarget,
    path: string,
  ) =>
    target.kind === "workspace"
      ? organizations.workspaces[":workspaceId"].project.files.$get({
          param: { organizationId, workspaceId: target.id },
          query: { path },
        })
      : organizations["work-sessions"][":workSessionId"].project.files.$get({
          param: { organizationId, workSessionId: target.id },
          query: { path },
        });

  const fileRequest = (
    organizationId: string,
    target: ProjectTarget,
    path: string,
  ) =>
    target.kind === "workspace"
      ? organizations.workspaces[":workspaceId"].project.file.$get({
          param: { organizationId, workspaceId: target.id },
          query: { path },
        })
      : organizations["work-sessions"][":workSessionId"].project.file.$get({
          param: { organizationId, workSessionId: target.id },
          query: { path },
        });

  return {
    /** Reads one folder of the target project; `""` is its root. */
    openDirectory: async (
      organizationId: string,
      target: ProjectTarget,
      path = "",
    ) => {
      const response = await listRequest(organizationId, target, path);
      if (!response.ok) throw await toApiError(response);
      store.dispatch({
        type: "project-directory-loaded",
        organizationId,
        target,
        path,
        entries: await readJson<ProjectEntry[]>(response),
      });
    },
    collapseDirectory: (path: string) => {
      store.dispatch({ type: "project-directory-collapsed", path });
    },
    openFile: async (
      organizationId: string,
      target: ProjectTarget,
      path: string,
    ) => {
      const response = await fileRequest(organizationId, target, path);
      if (!response.ok) throw await toApiError(response);
      store.dispatch({
        type: "project-file-loaded",
        organizationId,
        target,
        file: await readJson<ProjectFile>(response),
      });
    },
  };
}
