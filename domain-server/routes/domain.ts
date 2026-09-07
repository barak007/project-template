import { Hono } from "hono";
import { z } from "zod";

import { idSchema, keySchema } from "../entities/common.js";
import {
  invitationCreateSchema,
  invitationDecisionSchema,
  invitationResponseSchema,
} from "../entities/invitation.js";
import {
  membershipInputSchema,
  membershipResponseSchema,
  organizationCreateSchema,
  organizationResponseSchema,
} from "../entities/organization.js";
import {
  projectEntryResponseSchema,
  projectFileResponseSchema,
  projectPathQuerySchema,
} from "../entities/project.js";
import { repositoryInputSchema } from "../entities/repository.js";
import { sourceInputSchema, sourceResponseSchema } from "../entities/source.js";
import { userMessageResponseSchema } from "../entities/user-message.js";
import {
  dataInputSchema,
  dataResponseSchema,
  secretInputSchema,
  secretResponseSchema,
} from "../entities/value.js";
import {
  projectBranchSchema,
  workSessionCreateSchema,
  workSessionResponseSchema,
} from "../entities/work-session.js";
import {
  workspaceGrantInputSchema,
  workspaceGrantResponseSchema,
  workspaceInputSchema,
  workspaceResponseSchema,
  workspaceVisibilityInputSchema,
} from "../entities/workspace.js";
import { requireAuthentication } from "../http/auth-middleware.js";
import type { AppBindings, RuntimeDependencies } from "../http/context.js";
import { validate } from "../http/validation.js";
import {
  inviteMember,
  listInvitations,
  respondToInvitation,
  revokeInvitation,
} from "../services/invitations.js";
import {
  changeMemberRole,
  createOrganization,
  getOrganization,
  listMemberships,
  listOrganizations,
} from "../services/organizations.js";
import {
  listWorkspaceProjectDirectory,
  listWorkSessionDirectory,
  readWorkspaceProjectFile,
  readWorkSessionFile,
} from "../services/project-files.js";
import { addRepository } from "../services/repositories.js";
import {
  createSource,
  deleteSource,
  listSources,
  updateSource,
} from "../services/sources.js";
import { listUserMessages } from "../services/user-messages.js";
import {
  deleteOrganizationSecret,
  deleteUserSecret,
  listOrganizationData,
  listOrganizationSecrets,
  listUserData,
  listUserSecrets,
  putOrganizationData,
  putOrganizationSecret,
  putUserData,
  putUserSecret,
} from "../services/values.js";
import {
  branchWorkSessionProject,
  createWorkSession,
  getWorkSession,
  listWorkSessions,
} from "../services/work-sessions.js";
import {
  listGrants,
  putGrant,
  removeGrant,
  setWorkspaceVisibility,
} from "../services/workspace-access.js";
import {
  createWorkspace,
  deleteWorkspace,
  listWorkspaces,
  updateWorkspace,
} from "../services/workspaces.js";

const organizationParams = z.object({ organizationId: idSchema });
const sourceParams = organizationParams.extend({ sourceId: idSchema });
const workspaceParams = organizationParams.extend({ workspaceId: idSchema });
const workSessionParams = organizationParams.extend({
  workSessionId: idSchema,
});
const secretParams = organizationParams.extend({ key: keySchema });
const invitationParams = organizationParams.extend({ invitationId: idSchema });
/** A grant is addressed by the person it is for, and user ids are not uuids. */
const grantParams = workspaceParams.extend({ userId: z.string().min(1) });
const userKeyParams = z.object({ key: keySchema });
const userInvitationParams = z.object({ invitationId: idSchema });

export function createDomainRoutes(dependencies: RuntimeDependencies) {
  const routes = new Hono<AppBindings>();
  routes.use("*", requireAuthentication(dependencies));

  return (
    routes
      .get("/organizations", async (context) => {
        const result = await listOrganizations(
          dependencies.db,
          context.get("user").id,
        );
        return context.json(
          z.array(organizationResponseSchema).parse(result),
          200,
        );
      })
      .post(
        "/organizations",
        validate("json", organizationCreateSchema),
        async (context) => {
          const result = await createOrganization(
            dependencies.db,
            context.get("user").id,
            context.req.valid("json"),
          );
          return context.json(organizationResponseSchema.parse(result), 201);
        },
      )
      .get(
        "/organizations/:organizationId",
        validate("param", organizationParams),
        async (context) => {
          const result = await getOrganization(
            dependencies.db,
            context.get("user").id,
            context.req.valid("param").organizationId,
          );
          return context.json(organizationResponseSchema.parse(result), 200);
        },
      )
      .get(
        "/organizations/:organizationId/members",
        validate("param", organizationParams),
        async (context) => {
          const result = await listMemberships(
            dependencies.db,
            context.get("user").id,
            context.req.valid("param").organizationId,
          );
          return context.json(
            z.array(membershipResponseSchema).parse(result),
            200,
          );
        },
      )
      .put(
        "/organizations/:organizationId/members",
        validate("param", organizationParams),
        validate("json", membershipInputSchema),
        async (context) => {
          const result = await changeMemberRole(
            dependencies.db,
            context.get("user").id,
            context.req.valid("param").organizationId,
            context.req.valid("json"),
          );
          return context.json(membershipResponseSchema.parse(result), 200);
        },
      )
      // Joining is an invitation to an address, answered by whoever owns it —
      // see /me/invitations below for the other half of the exchange.
      .get(
        "/organizations/:organizationId/invitations",
        validate("param", organizationParams),
        async (context) => {
          const result = await listInvitations(
            dependencies.db,
            context.get("user").id,
            context.req.valid("param").organizationId,
          );
          return context.json(
            z.array(invitationResponseSchema).parse(result),
            200,
          );
        },
      )
      .post(
        "/organizations/:organizationId/invitations",
        validate("param", organizationParams),
        validate("json", invitationCreateSchema),
        async (context) => {
          const result = await inviteMember(
            dependencies.db,
            dependencies.mailer,
            context.get("user").id,
            context.req.valid("param").organizationId,
            context.req.valid("json"),
          );
          return context.json(invitationResponseSchema.parse(result), 201);
        },
      )
      .delete(
        "/organizations/:organizationId/invitations/:invitationId",
        validate("param", invitationParams),
        async (context) => {
          const params = context.req.valid("param");
          const result = await revokeInvitation(
            dependencies.db,
            context.get("user").id,
            params.organizationId,
            params.invitationId,
          );
          return context.json(invitationResponseSchema.parse(result), 200);
        },
      )
      .post(
        "/organizations/:organizationId/repositories",
        validate("param", organizationParams),
        validate("json", repositoryInputSchema),
        async (context) => {
          const result = await addRepository(
            dependencies.db,
            context.get("user").id,
            context.req.valid("param").organizationId,
            context.req.valid("json"),
          );
          return context.json(sourceResponseSchema.parse(result), 201);
        },
      )
      .get(
        "/organizations/:organizationId/sources",
        validate("param", organizationParams),
        async (context) => {
          const result = await listSources(
            dependencies.db,
            context.get("user").id,
            context.req.valid("param").organizationId,
          );
          return context.json(z.array(sourceResponseSchema).parse(result), 200);
        },
      )
      .post(
        "/organizations/:organizationId/sources",
        validate("param", organizationParams),
        validate("json", sourceInputSchema),
        async (context) => {
          const result = await createSource(
            dependencies.db,
            context.get("user").id,
            context.req.valid("param").organizationId,
            context.req.valid("json"),
          );
          return context.json(sourceResponseSchema.parse(result), 201);
        },
      )
      .put(
        "/organizations/:organizationId/sources/:sourceId",
        validate("param", sourceParams),
        validate("json", sourceInputSchema),
        async (context) => {
          const params = context.req.valid("param");
          const result = await updateSource(
            dependencies.db,
            context.get("user").id,
            params.organizationId,
            params.sourceId,
            context.req.valid("json"),
          );
          return context.json(sourceResponseSchema.parse(result), 200);
        },
      )
      .delete(
        "/organizations/:organizationId/sources/:sourceId",
        validate("param", sourceParams),
        async (context) => {
          const params = context.req.valid("param");
          await deleteSource(
            dependencies.db,
            context.get("user").id,
            params.organizationId,
            params.sourceId,
          );
          return context.body(null, 204);
        },
      )
      .get(
        "/organizations/:organizationId/workspaces",
        validate("param", organizationParams),
        async (context) => {
          const result = await listWorkspaces(
            dependencies.db,
            context.get("user").id,
            context.req.valid("param").organizationId,
          );
          return context.json(
            z.array(workspaceResponseSchema).parse(result),
            200,
          );
        },
      )
      .post(
        "/organizations/:organizationId/workspaces",
        validate("param", organizationParams),
        validate("json", workspaceInputSchema),
        async (context) => {
          const result = await createWorkspace(
            dependencies.db,
            context.get("user").id,
            context.req.valid("param").organizationId,
            context.req.valid("json"),
          );
          return context.json(workspaceResponseSchema.parse(result), 201);
        },
      )
      .put(
        "/organizations/:organizationId/workspaces/:workspaceId",
        validate("param", workspaceParams),
        validate("json", workspaceInputSchema),
        async (context) => {
          const params = context.req.valid("param");
          const result = await updateWorkspace(
            dependencies.db,
            context.get("user").id,
            params.organizationId,
            params.workspaceId,
            context.req.valid("json"),
          );
          return context.json(workspaceResponseSchema.parse(result), 200);
        },
      )
      .delete(
        "/organizations/:organizationId/workspaces/:workspaceId",
        validate("param", workspaceParams),
        async (context) => {
          const params = context.req.valid("param");
          await deleteWorkspace(
            dependencies.db,
            context.get("user").id,
            params.organizationId,
            params.workspaceId,
          );
          return context.body(null, 204);
        },
      )
      // Who may reach one workspace. Both levers are `workspace:manage`, which
      // an organization's owners and admins hold everywhere and a workspace's
      // own manager holds on theirs.
      .get(
        "/organizations/:organizationId/workspaces/:workspaceId/grants",
        validate("param", workspaceParams),
        async (context) => {
          const params = context.req.valid("param");
          const result = await listGrants(
            dependencies.db,
            context.get("user").id,
            params.organizationId,
            params.workspaceId,
          );
          return context.json(
            z.array(workspaceGrantResponseSchema).parse(result),
            200,
          );
        },
      )
      .put(
        "/organizations/:organizationId/workspaces/:workspaceId/grants",
        validate("param", workspaceParams),
        validate("json", workspaceGrantInputSchema),
        async (context) => {
          const params = context.req.valid("param");
          const result = await putGrant(
            dependencies.db,
            context.get("user").id,
            params.organizationId,
            params.workspaceId,
            context.req.valid("json"),
          );
          return context.json(workspaceGrantResponseSchema.parse(result), 200);
        },
      )
      .delete(
        "/organizations/:organizationId/workspaces/:workspaceId/grants/:userId",
        validate("param", grantParams),
        async (context) => {
          const params = context.req.valid("param");
          await removeGrant(
            dependencies.db,
            context.get("user").id,
            params.organizationId,
            params.workspaceId,
            params.userId,
          );
          return context.body(null, 204);
        },
      )
      .put(
        "/organizations/:organizationId/workspaces/:workspaceId/visibility",
        validate("param", workspaceParams),
        validate("json", workspaceVisibilityInputSchema),
        async (context) => {
          const params = context.req.valid("param");
          const result = await setWorkspaceVisibility(
            dependencies.db,
            context.get("user").id,
            params.organizationId,
            params.workspaceId,
            context.req.valid("json").visibility,
          );
          // The response is the workspace itself, so a client folds it into the
          // list it already holds instead of re-reading.
          return context.json(workspaceResponseSchema.parse(result), 200);
        },
      )
      // The workspace's own project — the template a session clones — browsed
      // exactly like a session's copy of it.
      .get(
        "/organizations/:organizationId/workspaces/:workspaceId/project/files",
        validate("param", workspaceParams),
        validate("query", projectPathQuerySchema),
        async (context) => {
          const params = context.req.valid("param");
          const result = await listWorkspaceProjectDirectory(
            dependencies.db,
            dependencies.projectFiles,
            context.get("user").id,
            params.organizationId,
            params.workspaceId,
            context.req.valid("query").path,
          );
          return context.json(
            z.array(projectEntryResponseSchema).parse(result),
            200,
          );
        },
      )
      .get(
        "/organizations/:organizationId/workspaces/:workspaceId/project/file",
        validate("param", workspaceParams),
        validate("query", projectPathQuerySchema),
        async (context) => {
          const params = context.req.valid("param");
          const result = await readWorkspaceProjectFile(
            dependencies.db,
            dependencies.projectFiles,
            context.get("user").id,
            params.organizationId,
            params.workspaceId,
            context.req.valid("query").path,
          );
          return context.json(projectFileResponseSchema.parse(result), 200);
        },
      )
      .get(
        "/organizations/:organizationId/secrets",
        validate("param", organizationParams),
        async (context) => {
          const result = await listOrganizationSecrets(
            dependencies.db,
            context.get("user").id,
            context.req.valid("param").organizationId,
          );
          return context.json(z.array(secretResponseSchema).parse(result), 200);
        },
      )
      .put(
        "/organizations/:organizationId/secrets",
        validate("param", organizationParams),
        validate("json", secretInputSchema),
        async (context) => {
          const result = await putOrganizationSecret(
            dependencies.db,
            dependencies.cipher,
            context.get("user").id,
            context.req.valid("param").organizationId,
            context.req.valid("json"),
          );
          return context.json(secretResponseSchema.parse(result), 200);
        },
      )
      .delete(
        "/organizations/:organizationId/secrets/:key",
        validate("param", secretParams),
        async (context) => {
          const params = context.req.valid("param");
          await deleteOrganizationSecret(
            dependencies.db,
            context.get("user").id,
            params.organizationId,
            params.key,
          );
          return context.body(null, 204);
        },
      )
      .get(
        "/organizations/:organizationId/data",
        validate("param", organizationParams),
        async (context) => {
          const result = await listOrganizationData(
            dependencies.db,
            context.get("user").id,
            context.req.valid("param").organizationId,
          );
          return context.json(z.array(dataResponseSchema).parse(result), 200);
        },
      )
      .put(
        "/organizations/:organizationId/data",
        validate("param", organizationParams),
        validate("json", dataInputSchema),
        async (context) => {
          const result = await putOrganizationData(
            dependencies.db,
            context.get("user").id,
            context.req.valid("param").organizationId,
            context.req.valid("json"),
          );
          return context.json(dataResponseSchema.parse(result), 200);
        },
      )
      .get(
        "/organizations/:organizationId/work-sessions",
        validate("param", organizationParams),
        async (context) => {
          const result = await listWorkSessions(
            dependencies.db,
            context.get("user").id,
            context.req.valid("param").organizationId,
          );
          return context.json(
            z.array(workSessionResponseSchema).parse(result),
            200,
          );
        },
      )
      .post(
        "/organizations/:organizationId/work-sessions",
        validate("param", organizationParams),
        validate("json", workSessionCreateSchema),
        async (context) => {
          const result = await createWorkSession(
            dependencies.db,
            dependencies.jobs,
            context.get("user").id,
            context.req.valid("param").organizationId,
            context.req.valid("json").workspaceId,
          );
          return context.json(workSessionResponseSchema.parse(result), 202);
        },
      )
      .get(
        "/organizations/:organizationId/work-sessions/:workSessionId",
        validate("param", workSessionParams),
        async (context) => {
          const params = context.req.valid("param");
          const result = await getWorkSession(
            dependencies.db,
            context.get("user").id,
            params.organizationId,
            params.workSessionId,
          );
          return context.json(workSessionResponseSchema.parse(result), 200);
        },
      )
      // A session's project is browsed one directory and one file at a time, so a
      // deep tree costs a click rather than a whole-repository payload — and the
      // reading happens on the server, wherever the project actually lives.
      .get(
        "/organizations/:organizationId/work-sessions/:workSessionId/project/files",
        validate("param", workSessionParams),
        validate("query", projectPathQuerySchema),
        async (context) => {
          const params = context.req.valid("param");
          const result = await listWorkSessionDirectory(
            dependencies.db,
            dependencies.projectFiles,
            context.get("user").id,
            params.organizationId,
            params.workSessionId,
            context.req.valid("query").path,
          );
          return context.json(
            z.array(projectEntryResponseSchema).parse(result),
            200,
          );
        },
      )
      .get(
        "/organizations/:organizationId/work-sessions/:workSessionId/project/file",
        validate("param", workSessionParams),
        validate("query", projectPathQuerySchema),
        async (context) => {
          const params = context.req.valid("param");
          const result = await readWorkSessionFile(
            dependencies.db,
            dependencies.projectFiles,
            context.get("user").id,
            params.organizationId,
            params.workSessionId,
            context.req.valid("query").path,
          );
          return context.json(projectFileResponseSchema.parse(result), 200);
        },
      )
      .post(
        "/organizations/:organizationId/work-sessions/:workSessionId/project/branch",
        validate("param", workSessionParams),
        validate("json", projectBranchSchema),
        async (context) => {
          const params = context.req.valid("param");
          const result = await branchWorkSessionProject(
            dependencies.db,
            dependencies.projectBuilder,
            context.get("user").id,
            params.organizationId,
            params.workSessionId,
            context.req.valid("json").branch,
          );
          return context.json(workSessionResponseSchema.parse(result), 200);
        },
      )
      // The invited person's side: what is waiting for them, and their answer.
      // Keyed by their identity and address, so no invitation token travels
      // anywhere and a forwarded invitation is unusable by anyone else.
      .get("/me/messages", async (context) => {
        const user = context.get("user");
        const result = await listUserMessages(dependencies.db, {
          id: user.id,
          email: user.email,
        });
        return context.json(
          z.array(userMessageResponseSchema).parse(result),
          200,
        );
      })
      .post(
        "/me/invitations/:invitationId/response",
        validate("param", userInvitationParams),
        validate("json", invitationDecisionSchema),
        async (context) => {
          const user = context.get("user");
          const result = await respondToInvitation(
            dependencies.db,
            { id: user.id, email: user.email },
            context.req.valid("param").invitationId,
            context.req.valid("json").decision,
          );
          return context.json(invitationResponseSchema.parse(result), 200);
        },
      )
      .get("/me/secrets", async (context) => {
        const result = await listUserSecrets(
          dependencies.db,
          context.get("user").id,
        );
        return context.json(z.array(secretResponseSchema).parse(result), 200);
      })
      .put(
        "/me/secrets",
        validate("json", secretInputSchema),
        async (context) => {
          const result = await putUserSecret(
            dependencies.db,
            dependencies.cipher,
            context.get("user").id,
            context.req.valid("json"),
          );
          return context.json(secretResponseSchema.parse(result), 200);
        },
      )
      .delete(
        "/me/secrets/:key",
        validate("param", userKeyParams),
        async (context) => {
          await deleteUserSecret(
            dependencies.db,
            context.get("user").id,
            context.req.valid("param").key,
          );
          return context.body(null, 204);
        },
      )
      .get("/me/data", async (context) => {
        const result = await listUserData(
          dependencies.db,
          context.get("user").id,
        );
        return context.json(z.array(dataResponseSchema).parse(result), 200);
      })
      .put("/me/data", validate("json", dataInputSchema), async (context) => {
        const result = await putUserData(
          dependencies.db,
          context.get("user").id,
          context.req.valid("json"),
        );
        return context.json(dataResponseSchema.parse(result), 200);
      })
  );
}

export type DomainRoutes = ReturnType<typeof createDomainRoutes>;
