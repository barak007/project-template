import { z } from "zod";

import { timestampsSchema } from "../../../domain-server/entities/common.js";
import {
  memberRoleSchema,
  organizationResponseSchema,
} from "../../../domain-server/entities/organization.js";

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

// The password is write-only: it is hashed into the credential account row
// and never appears in any response.
export const createAdminUserBodySchema = z.object({
  name: z.string().trim().min(1),
  email: z.email(),
  password: z.string().min(8),
});

export type CreateAdminUserInput = z.infer<typeof createAdminUserBodySchema>;

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

// Provider inventory only — the password hash and OAuth tokens never leave
// the database through the backoffice.
export const adminAccountResponseSchema = z
  .object({ id: z.string(), providerId: z.string() })
  .extend(timestampsSchema.shape);

export const adminSessionResponseSchema = z.object({
  id: z.string(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  expiresAt: z.coerce.date(),
  createdAt: z.coerce.date(),
});

export const adminMembershipResponseSchema = z.object({
  organizationId: z.uuid(),
  organizationName: z.string(),
  role: memberRoleSchema,
  createdAt: z.coerce.date(),
});

export const adminUserDetailResponseSchema = z.object({
  user: adminUserResponseSchema,
  accounts: z.array(adminAccountResponseSchema),
  sessions: z.array(adminSessionResponseSchema),
  memberships: z.array(adminMembershipResponseSchema),
  workSessions: z.array(
    adminWorkSessionResponseSchema.extend({ organizationId: z.uuid() }),
  ),
});

export const adminOrganizationDetailResponseSchema = z.object({
  organization: organizationResponseSchema,
  members: z.array(adminMemberResponseSchema),
  sources: z.array(adminSourceResponseSchema),
  workspaces: z.array(adminWorkspaceResponseSchema),
  workSessions: z.array(adminWorkSessionResponseSchema),
});
