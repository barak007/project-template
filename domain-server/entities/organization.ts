import { z } from "zod";

import { timestampsSchema } from "./common.js";

export const organizationCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
});
export const organizationResponseSchema = z
  .object({ id: z.uuid(), name: z.string() })
  .extend(timestampsSchema.shape);
export const memberRoleSchema = z.enum(["owner", "admin", "member"]);
/**
 * A membership names a person, not just an id: everyone in an organization can
 * read this list, and a colleague has to be recognisable to be granted a
 * workspace or given a role.
 */
export const membershipResponseSchema = z.object({
  organizationId: z.uuid(),
  userId: z.string(),
  role: memberRoleSchema,
  name: z.string(),
  email: z.string(),
  createdAt: z.coerce.date(),
});
/** A role change for someone already in the organization; see invitation.ts to add one. */
export const membershipInputSchema = z.object({
  userId: z.string().min(1),
  role: memberRoleSchema,
});
export type OrganizationCreate = z.infer<typeof organizationCreateSchema>;
