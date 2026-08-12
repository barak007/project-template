import { z } from "zod";

import { timestampsSchema } from "./common.js";
import { memberRoleSchema } from "./organization.js";

export const invitationStatusSchema = z.enum([
  "pending",
  "accepted",
  "declined",
  "revoked",
]);

/**
 * An invitation is addressed to an email, so the address is normalised here
 * rather than by every caller: an invitation for `Ada@Example.com` and the
 * account `ada@example.com` are the same person.
 */
export const invitationCreateSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(320)),
  role: memberRoleSchema,
});

export const invitationResponseSchema = z
  .object({
    id: z.uuid(),
    organizationId: z.uuid(),
    email: z.string(),
    role: memberRoleSchema,
    status: invitationStatusSchema,
    invitedByUserId: z.string(),
    respondedAt: z.coerce.date().nullable(),
  })
  .extend(timestampsSchema.shape);

export const invitationDecisionSchema = z.object({
  decision: z.enum(["accept", "decline"]),
});

export type InvitationCreate = z.infer<typeof invitationCreateSchema>;
export type InvitationDecision = z.infer<
  typeof invitationDecisionSchema
>["decision"];
