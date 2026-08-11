import { readJson } from "./api.js";
import type { Api, ProjectEntry, ProjectFile } from "./api.js";
import { toApiError } from "./errors.js";
import type { ClientStore } from "./projection.js";

/**
 * The files a work session opened on, read through the API a directory and a
 * file at a time. Nothing here touches a filesystem — the session's project can
 * live on a machine the person browsing it has no access to, which is the whole
 * reason the server does the reading.
 */
export function createSessionFileActions(api: Api, store: ClientStore) {
  const routes =
    api.api.organizations[":organizationId"]["work-sessions"][":workSessionId"]
      .project;
  return {
    /** Reads one folder; `""` is the project root. */
    openDirectory: async (
      organizationId: string,
      workSessionId: string,
      path = "",
    ) => {
      const response = await routes.files.$get({
        param: { organizationId, workSessionId },
        query: { path },
      });
      if (!response.ok) throw await toApiError(response);
      store.dispatch({
        type: "session-directory-loaded",
        organizationId,
        workSessionId,
        path,
        entries: await readJson<ProjectEntry[]>(response),
      });
    },
    collapseDirectory: (path: string) => {
      store.dispatch({ type: "session-directory-collapsed", path });
    },
    openFile: async (
      organizationId: string,
      workSessionId: string,
      path: string,
    ) => {
      const response = await routes.file.$get({
        param: { organizationId, workSessionId },
        query: { path },
      });
      if (!response.ok) throw await toApiError(response);
      store.dispatch({
        type: "session-file-loaded",
        organizationId,
        workSessionId,
        file: await readJson<ProjectFile>(response),
      });
    },
  };
}
