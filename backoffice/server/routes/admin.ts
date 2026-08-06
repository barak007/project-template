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
} from "../entities/admin.js";
import {
  getOrganizationDetail,
  listAllOrganizations,
  listAllUsers,
} from "../services/admin.js";
import { requireBackofficeAdmin } from "../session.js";

const organizationParams = z.object({ organizationId: idSchema });

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
    .get("/organizations", async (context) => {
      const result = await listAllOrganizations(dependencies.db);
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
          context.req.valid("param").organizationId,
        );
        return context.json(
          adminOrganizationDetailResponseSchema.parse(result),
          200,
        );
      },
    );
}
