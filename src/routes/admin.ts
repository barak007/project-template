import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import {
  adminOrganizationDetailResponseSchema,
  adminUserResponseSchema,
} from "../entities/admin.js";
import { idSchema } from "../entities/common.js";
import { organizationResponseSchema } from "../entities/organization.js";
import { requireAuthentication } from "../http/auth-middleware.js";
import type { AppBindings, RuntimeDependencies } from "../http/context.js";
import { validationHook } from "../http/validation.js";
import {
  getOrganizationDetail,
  listAllOrganizations,
  listAllUsers,
} from "../services/admin.js";

const organizationParams = z.object({ organizationId: idSchema });

export function createAdminRoutes(dependencies: RuntimeDependencies) {
  const routes = new Hono<AppBindings>();
  routes.use("*", requireAuthentication(dependencies));

  return routes
    .get("/users", async (context) => {
      const result = await listAllUsers(
        dependencies.db,
        context.get("user").id,
      );
      return context.json(z.array(adminUserResponseSchema).parse(result), 200);
    })
    .get("/organizations", async (context) => {
      const result = await listAllOrganizations(
        dependencies.db,
        context.get("user").id,
      );
      return context.json(
        z.array(organizationResponseSchema).parse(result),
        200,
      );
    })
    .get(
      "/organizations/:organizationId",
      zValidator("param", organizationParams, validationHook),
      async (context) => {
        const result = await getOrganizationDetail(
          dependencies.db,
          context.get("user").id,
          context.req.valid("param").organizationId,
        );
        return context.json(
          adminOrganizationDetailResponseSchema.parse(result),
          200,
        );
      },
    );
}

export type AdminRoutes = ReturnType<typeof createAdminRoutes>;
