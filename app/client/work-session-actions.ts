import type { AppActionContext } from "./context.js";
import { actionKeys, loadKeys } from "./keys.js";

/**
 * Sessions of one workspace. Creating one is the point of the product: the
 * server snapshots the workspace and a job builds the git project the session
 * opens, so `create` returns as soon as the session is durable and the page
 * follows it to `ready` by refreshing.
 */
export function createWorkSessionActions({
  client,
  store,
  attempt,
}: AppActionContext) {
  return {
    load: (organizationId: string) =>
      attempt(() => client.workSessions.load(organizationId), {
        loaded: loadKeys.sessions(organizationId),
      }),
    create: (organizationId: string, workspaceId: string) =>
      attempt(() => client.workSessions.start(organizationId, workspaceId), {
        key: actionKeys.createSession(workspaceId),
      }),
    /**
     * Re-reads every session still being prepared. One call per page tick keeps
     * the polling decision in the core rather than in a component.
     *
     * Background work: the user did not press anything, so a tick must not clear
     * the error they are reading or make a control look busy.
     */
    refreshPending: (organizationId: string) =>
      attempt(
        async () => {
          const pending = store
            .getState()
            .workSessions.filter(
              (session) =>
                session.status === "pending" ||
                session.status === "materializing",
            );
          for (const session of pending)
            await client.workSessions.refresh(organizationId, session.id);
        },
        { background: true },
      ),
    branchAll: (
      organizationId: string,
      workSessionId: string,
      branch: string,
    ) =>
      attempt(() =>
        client.workSessions.branchAll(organizationId, workSessionId, branch),
      ),
  };
}
