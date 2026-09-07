import { Hono } from "hono";
import { z } from "zod";

import { idSchema } from "../entities/common.js";
import { sourceInputSchema, sourceResponseSchema } from "../entities/source.js";
import type { AppBindings, RuntimeDependencies } from "../http/context.js";
import { validate } from "../http/validation.js";
import {
  createSource,
  deleteSource,
  listSources,
  updateSource,
} from "../services/sources.js";

import { organizationParams } from "./params.js";

const sourceParams = organizationParams.extend({ sourceId: idSchema });

export function createSourceRoutes(dependencies: RuntimeDependencies) {
  return new Hono<AppBindings>()
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
    );
}
