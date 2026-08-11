import type { Membership } from "../../domain-client/index.js";

import type { AppActionContext } from "./context.js";
import { actionKeys, loadKeys } from "./keys.js";

/**
 * Who belongs to an organization, and with what role. Membership is the app's
 * only access control: a workspace has no members of its own, so everything
 * inside an organization is reachable by everyone in this list — which is why
 * the workspace page states that rather than offering a second list to manage.
 *
 * The server's membership is `{ userId, role }` with no name or email, so a role
 * can be changed here but a person cannot be invited by address: that needs an
 * invitation the API does not have yet.
 */
export function createMemberActions({ client, attempt }: AppActionContext) {
  return {
    load: (organizationId: string) =>
      attempt(() => client.members.load(organizationId), {
        loaded: loadKeys.members(organizationId),
      }),
    changeRole: (
      organizationId: string,
      userId: string,
      role: Membership["role"],
    ) =>
      attempt(() => client.members.put(organizationId, { userId, role }), {
        key: actionKeys.changeRole(userId),
      }),
  };
}
