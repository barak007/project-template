import { Hono } from "hono";

import { repositoryInputSchema } from "../entities/repository.js";
import { sourceResponseSchema } from "../entities/source.js";
import type { AppBindings, RuntimeDependencies } from "../http/context.js";
import { validate } from "../http/validation.js";
import { addRepository } from "../services/repositories.js";

import { organizationParams } from "./params.js";

export function createRepositoryRoutes(dependencies: RuntimeDependencies) {
  return new Hono<AppBindings>().post(
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
  );
}
