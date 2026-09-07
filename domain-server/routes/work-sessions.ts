import { Hono } from "hono";
import { z } from "zod";

import {
  projectBranchSchema,
  workSessionCreateSchema,
  workSessionResponseSchema,
} from "../entities/work-session.js";
import type { AppBindings, RuntimeDependencies } from "../http/context.js";
import { validate } from "../http/validation.js";
import {
  branchWorkSessionProject,
  createWorkSession,
  getWorkSession,
  listWorkSessions,
} from "../services/work-sessions.js";

import { organizationParams, workSessionParams } from "./params.js";

export function createWorkSessionRoutes(dependencies: RuntimeDependencies) {
  return new Hono<AppBindings>()
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
    );
}
