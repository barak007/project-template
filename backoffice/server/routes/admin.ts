import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { idSchema } from "../../../domain-server/entities/common.js";
import { organizationResponseSchema } from "../../../domain-server/entities/organization.js";
import { validationHook } from "../../../domain-server/http/validation.js";
import type { BackofficeDependencies } from "../dependencies.js";
import {
  adminOrganizationDetailResponseSchema,
  adminUserResponseSchema,
  createAdminOrganizationBodySchema,
  createAdminUserBodySchema,
} from "../entities/admin.js";
import {
  createOrganization,
  createUser,
  deleteOrganization,
  deleteUser,
  getOrganizationDetail,
  listAllOrganizations,
  listAllUsers,
} from "../services/admin.js";
import { requireBackofficeAdmin } from "../session.js";

const organizationParams = z.object({ organizationId: idSchema });
// User ids are better-auth text ids, not uuids.
const userParams = z.object({ userId: z.string().min(1) });

export function createBackofficeAdminRoutes(
  dependencies: BackofficeDependencies,
) {
  const routes = new Hono();
  routes.use("*", requireBackofficeAdmin(dependencies));

  return routes
    .get("/users", async (context) => {
      const result = await listAllUsers(dependencies.db);
      return context.json(z.array(adminUserResponseSchema).parse(result), 200);
    })
    .post(
      "/users",
      zValidator("json", createAdminUserBodySchema, validationHook),
      async (context) => {
        const result = await createUser(
          dependencies.db,
          context.req.valid("json"),
        );
        return context.json(adminUserResponseSchema.parse(result), 201);
      },
    )
    .delete(
      "/users/:userId",
      zValidator("param", userParams, validationHook),
      async (context) => {
        await deleteUser(dependencies.db, context.req.valid("param").userId);
        return context.body(null, 204);
      },
    )
    .get("/organizations", async (context) => {
      const result = await listAllOrganizations(dependencies.db);
      return context.json(
        z.array(organizationResponseSchema).parse(result),
        200,
      );
    })
    .post(
      "/organizations",
      zValidator("json", createAdminOrganizationBodySchema, validationHook),
      async (context) => {
        const result = await createOrganization(
          dependencies.db,
          context.req.valid("json"),
        );
        return context.json(organizationResponseSchema.parse(result), 201);
      },
    )
    .delete(
      "/organizations/:organizationId",
      zValidator("param", organizationParams, validationHook),
      async (context) => {
        await deleteOrganization(
          dependencies.db,
          context.req.valid("param").organizationId,
        );
        return context.body(null, 204);
      },
    )
    .get(
      "/organizations/:organizationId",
      zValidator("param", organizationParams, validationHook),
      async (context) => {
        const result = await getOrganizationDetail(
          dependencies.db,
          context.req.valid("param").organizationId,
        );
        return context.json(
          adminOrganizationDetailResponseSchema.parse(result),
          200,
        );
      },
    );
}
