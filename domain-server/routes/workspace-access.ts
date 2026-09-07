import { Hono } from "hono";
import { z } from "zod";

import {
  workspaceGrantInputSchema,
  workspaceGrantResponseSchema,
  workspaceResponseSchema,
  workspaceVisibilityInputSchema,
} from "../entities/workspace.js";
import type { AppBindings, RuntimeDependencies } from "../http/context.js";
import { validate } from "../http/validation.js";
import {
  listGrants,
  putGrant,
  removeGrant,
  setWorkspaceVisibility,
} from "../services/workspace-access.js";

import { workspaceParams } from "./params.js";

/** A grant is addressed by the person it is for, and user ids are not uuids. */
const grantParams = workspaceParams.extend({ userId: z.string().min(1) });

export function createWorkspaceAccessRoutes(dependencies: RuntimeDependencies) {
  return (
    new Hono<AppBindings>()
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
  );
}
