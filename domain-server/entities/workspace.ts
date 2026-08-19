import { z } from "zod";

import { timestampsSchema } from "./common.js";
import { projectLocationSchema } from "./project.js";

export const workspaceRoleSchema = z.enum([
  "viewer",
  "operator",
  "editor",
  "manager",
]);
export const workspaceVisibilitySchema = z.enum([
  "organization",
  "restricted",
]);

export const workspaceInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  sourceIds: z
    .array(z.uuid())
    .max(100)
    .default([])
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "sourceIds must be unique",
    }),
});
export const workspaceResponseSchema = z
  .object({
    id: z.uuid(),
    organizationId: z.uuid(),
    name: z.string(),
    sourceIds: z.array(z.uuid()),
    /** `organization` is every member; `restricted` is its grants and nobody else. */
    visibility: workspaceVisibilitySchema,
    /**
     * What the person who asked may do with this workspace — resolved by the
     * server, so a UI offers exactly what the API will allow instead of
     * re-deriving the rule and guessing wrong.
     */
    yourRole: workspaceRoleSchema,
    /**
     * The git project this workspace owns — the template every session clones.
     * Null until the first session builds it.
     */
    projectLocation: projectLocationSchema.nullable(),
  })
  .extend(timestampsSchema.shape);
export const workspaceVisibilityInputSchema = z.object({
  visibility: workspaceVisibilitySchema,
});

/** One person's access to one workspace, named so a manager can read the row. */
export const workspaceGrantInputSchema = z.object({
  userId: z.string().min(1),
  role: workspaceRoleSchema,
});
export const workspaceGrantResponseSchema = z.object({
  workspaceId: z.uuid(),
  userId: z.string(),
  role: workspaceRoleSchema,
  name: z.string(),
  email: z.string(),
  createdAt: z.coerce.date(),
});

export type WorkspaceInput = z.infer<typeof workspaceInputSchema>;
export type WorkspaceGrantInput = z.infer<typeof workspaceGrantInputSchema>;
