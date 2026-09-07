import { Hono } from "hono";
import { z } from "zod";

import {
  projectEntryResponseSchema,
  projectFileResponseSchema,
  projectPathQuerySchema,
} from "../entities/project.js";
import type { AppBindings, RuntimeDependencies } from "../http/context.js";
import { validate } from "../http/validation.js";
import {
  listWorkspaceProjectDirectory,
  listWorkSessionDirectory,
  readWorkspaceProjectFile,
  readWorkSessionFile,
} from "../services/project-files.js";

import { workSessionParams, workspaceParams } from "./params.js";

export function createProjectFileRoutes(dependencies: RuntimeDependencies) {
  return (
    new Hono<AppBindings>()
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
  );
}
