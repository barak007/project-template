import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { idSchema, keySchema } from "../entities/common.js";
import {
  membershipInputSchema,
  membershipResponseSchema,
  organizationCreateSchema,
  organizationResponseSchema,
} from "../entities/organization.js";
import { repositoryInputSchema } from "../entities/repository.js";
import { sourceInputSchema, sourceResponseSchema } from "../entities/source.js";
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
  workspaceInputSchema,
  workspaceResponseSchema,
} from "../entities/workspace.js";
import { requireAuthentication } from "../http/auth-middleware.js";
import type { AppBindings, RuntimeDependencies } from "../http/context.js";
import { validationHook } from "../http/validation.js";
import {
  createOrganization,
  getOrganization,
  listMemberships,
  listOrganizations,
  putMembership,
} from "../services/organizations.js";
import { addRepository } from "../services/repositories.js";
import {
  createSource,
  deleteSource,
  listSources,
  updateSource,
} from "../services/sources.js";
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
const userKeyParams = z.object({ key: keySchema });

export function createDomainRoutes(dependencies: RuntimeDependencies) {
  const routes = new Hono<AppBindings>();
  routes.use("*", requireAuthentication(dependencies));

  return routes
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
      zValidator("json", organizationCreateSchema, validationHook),
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
      zValidator("param", organizationParams, validationHook),
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
      zValidator("param", organizationParams, validationHook),
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
      zValidator("param", organizationParams, validationHook),
      zValidator("json", membershipInputSchema, validationHook),
      async (context) => {
        const result = await putMembership(
          dependencies.db,
          context.get("user").id,
          context.req.valid("param").organizationId,
          context.req.valid("json"),
        );
        return context.json(membershipResponseSchema.parse(result), 200);
      },
    )
    .post(
      "/organizations/:organizationId/repositories",
      zValidator("param", organizationParams, validationHook),
      zValidator("json", repositoryInputSchema, validationHook),
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
      zValidator("param", organizationParams, validationHook),
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
      zValidator("param", organizationParams, validationHook),
      zValidator("json", sourceInputSchema, validationHook),
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
      zValidator("param", sourceParams, validationHook),
      zValidator("json", sourceInputSchema, validationHook),
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
      zValidator("param", sourceParams, validationHook),
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
      zValidator("param", organizationParams, validationHook),
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
      zValidator("param", organizationParams, validationHook),
      zValidator("json", workspaceInputSchema, validationHook),
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
      zValidator("param", workspaceParams, validationHook),
      zValidator("json", workspaceInputSchema, validationHook),
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
      zValidator("param", workspaceParams, validationHook),
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
    .get(
      "/organizations/:organizationId/secrets",
      zValidator("param", organizationParams, validationHook),
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
      zValidator("param", organizationParams, validationHook),
      zValidator("json", secretInputSchema, validationHook),
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
      zValidator("param", secretParams, validationHook),
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
      zValidator("param", organizationParams, validationHook),
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
      zValidator("param", organizationParams, validationHook),
      zValidator("json", dataInputSchema, validationHook),
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
      zValidator("param", organizationParams, validationHook),
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
      zValidator("param", organizationParams, validationHook),
      zValidator("json", workSessionCreateSchema, validationHook),
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
      zValidator("param", workSessionParams, validationHook),
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
    .post(
      "/organizations/:organizationId/work-sessions/:workSessionId/project/branch",
      zValidator("param", workSessionParams, validationHook),
      zValidator("json", projectBranchSchema, validationHook),
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
    .get("/me/secrets", async (context) => {
      const result = await listUserSecrets(
        dependencies.db,
        context.get("user").id,
      );
      return context.json(z.array(secretResponseSchema).parse(result), 200);
    })
    .put(
      "/me/secrets",
      zValidator("json", secretInputSchema, validationHook),
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
      zValidator("param", userKeyParams, validationHook),
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
    .put(
      "/me/data",
      zValidator("json", dataInputSchema, validationHook),
      async (context) => {
        const result = await putUserData(
          dependencies.db,
          context.get("user").id,
          context.req.valid("json"),
        );
        return context.json(dataResponseSchema.parse(result), 200);
      },
    );
}

export type DomainRoutes = ReturnType<typeof createDomainRoutes>;
