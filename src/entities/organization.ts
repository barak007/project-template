import { z } from "zod";

import { timestampsSchema } from "./common.js";

export const organizationCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
});
export const organizationResponseSchema = z
  .object({ id: z.uuid(), name: z.string() })
  .extend(timestampsSchema.shape);
export const memberRoleSchema = z.enum(["owner", "admin", "member"]);
export const membershipResponseSchema = z.object({
  organizationId: z.uuid(),
  userId: z.string(),
  role: memberRoleSchema,
  createdAt: z.coerce.date(),
});
export const membershipInputSchema = z.object({
  userId: z.string().min(1),
  role: memberRoleSchema,
});
export type OrganizationCreate = z.infer<typeof organizationCreateSchema>;
