import { Hono } from "hono";
import { z } from "zod";

import {
  membershipInputSchema,
  membershipResponseSchema,
  organizationCreateSchema,
  organizationResponseSchema,
} from "../entities/organization.js";
import type { AppBindings, RuntimeDependencies } from "../http/context.js";
import { validate } from "../http/validation.js";
import {
  changeMemberRole,
  createOrganization,
  getOrganization,
  listMemberships,
  listOrganizations,
} from "../services/organizations.js";

import { organizationParams } from "./params.js";

export function createOrganizationRoutes(dependencies: RuntimeDependencies) {
  return new Hono<AppBindings>()
    .get("/organizations", async (context) => {
      const result = await listOrganizations(
        dependencies.db,
        context.get("user").id,
      );
      return context.json(
        z.array(organizationResponseSchema).parse(result),
        200,
      );
    })
    .post(
      "/organizations",
      validate("json", organizationCreateSchema),
      async (context) => {
        const result = await createOrganization(
          dependencies.db,
          context.get("user").id,
          context.req.valid("json"),
        );
        return context.json(organizationResponseSchema.parse(result), 201);
      },
    )
    .get(
      "/organizations/:organizationId",
      validate("param", organizationParams),
      async (context) => {
        const result = await getOrganization(
          dependencies.db,
          context.get("user").id,
          context.req.valid("param").organizationId,
        );
        return context.json(organizationResponseSchema.parse(result), 200);
      },
    )
    .get(
      "/organizations/:organizationId/members",
      validate("param", organizationParams),
      async (context) => {
        const result = await listMemberships(
          dependencies.db,
          context.get("user").id,
          context.req.valid("param").organizationId,
        );
        return context.json(
          z.array(membershipResponseSchema).parse(result),
          200,
        );
      },
    )
    .put(
      "/organizations/:organizationId/members",
      validate("param", organizationParams),
      validate("json", membershipInputSchema),
      async (context) => {
        const result = await changeMemberRole(
          dependencies.db,
          context.get("user").id,
          context.req.valid("param").organizationId,
          context.req.valid("json"),
        );
        return context.json(membershipResponseSchema.parse(result), 200);
      },
    );
}
