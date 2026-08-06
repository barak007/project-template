import { z } from "zod";

import { timestampsSchema } from "../../../src/entities/common.js";
import {
  memberRoleSchema,
  organizationResponseSchema,
} from "../../../src/entities/organization.js";

// Admin responses stay flat on purpose: no source config, no work-session
// snapshots, no secret material — an operator console needs inventory and
// status, not tenant payloads.
export const adminUserResponseSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    emailVerified: z.boolean(),
  })
  .extend(timestampsSchema.shape);

export const adminMemberResponseSchema = z.object({
  userId: z.string(),
  role: memberRoleSchema,
  name: z.string(),
  email: z.string(),
  createdAt: z.coerce.date(),
});

export const adminSourceResponseSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    kind: z.enum(["git", "database", "other"]),
  })
  .extend(timestampsSchema.shape);

export const adminWorkspaceResponseSchema = z
  .object({ id: z.uuid(), name: z.string() })
  .extend(timestampsSchema.shape);

export const adminWorkSessionResponseSchema = z
  .object({
    id: z.uuid(),
    workspaceId: z.uuid(),
    createdByUserId: z.string(),
    status: z.enum(["pending", "materializing", "ready", "failed"]),
    failureCode: z.string().nullable(),
  })
  .extend(timestampsSchema.shape);

export const adminOrganizationDetailResponseSchema = z.object({
  organization: organizationResponseSchema,
  members: z.array(adminMemberResponseSchema),
  sources: z.array(adminSourceResponseSchema),
  workspaces: z.array(adminWorkspaceResponseSchema),
  workSessions: z.array(adminWorkSessionResponseSchema),
});
