import { Hono } from "hono";
import { z } from "zod";

import { keySchema } from "../entities/common.js";
import {
  dataInputSchema,
  dataResponseSchema,
  secretInputSchema,
  secretResponseSchema,
} from "../entities/value.js";
import type { AppBindings, RuntimeDependencies } from "../http/context.js";
import { validate } from "../http/validation.js";
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

import { organizationParams } from "./params.js";

const secretParams = organizationParams.extend({ key: keySchema });
const userKeyParams = z.object({ key: keySchema });

export function createValueRoutes(dependencies: RuntimeDependencies) {
  return new Hono<AppBindings>()
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
    });
}
