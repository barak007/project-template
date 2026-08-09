import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { idSchema } from "../../../domain-server/entities/common.js";
import { validationHook } from "../../../domain-server/http/validation.js";
import type { BackofficeDependencies } from "../dependencies.js";
import {
  adminOrganizationDetailResponseSchema,
  adminUserDetailResponseSchema,
  adminUserResponseSchema,
  createAdminUserBodySchema,
} from "../entities/admin.js";
import {
  createUser,
  deleteOrganization,
  getOrganizationDetail,
  getUserDetail,
} from "../services/admin.js";
import { requireBackofficeAdmin } from "../session.js";

const organizationParams = z.object({ organizationId: idSchema });
// User ids are better-auth text ids, not uuids.
const userParams = z.object({ userId: z.string().min(1) });

// Row listing and plain row mutations go through the data console routes;
// only operations with side effects beyond one row live here.
export function createBackofficeAdminRoutes(
  dependencies: BackofficeDependencies,
) {
  const routes = new Hono();
  routes.use("*", requireBackofficeAdmin(dependencies));

  return routes
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
    .get(
      "/users/:userId",
      zValidator("param", userParams, validationHook),
      async (context) => {
        const result = await getUserDetail(
          dependencies.db,
          context.req.valid("param").userId,
        );
        return context.json(adminUserDetailResponseSchema.parse(result), 200);
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
