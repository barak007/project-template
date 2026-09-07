import { Hono } from "hono";
import { z } from "zod";

import {
  workspaceInputSchema,
  workspaceResponseSchema,
} from "../entities/workspace.js";
import type { AppBindings, RuntimeDependencies } from "../http/context.js";
import { validate } from "../http/validation.js";
import {
  createWorkspace,
  deleteWorkspace,
  listWorkspaces,
  updateWorkspace,
} from "../services/workspaces.js";

import { organizationParams, workspaceParams } from "./params.js";

export function createWorkspaceRoutes(dependencies: RuntimeDependencies) {
  return new Hono<AppBindings>()
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
    );
}
