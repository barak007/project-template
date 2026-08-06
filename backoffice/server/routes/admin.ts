import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { idSchema } from "../../../src/entities/common.js";
import { organizationResponseSchema } from "../../../src/entities/organization.js";
import { validationHook } from "../../../src/http/validation.js";
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
