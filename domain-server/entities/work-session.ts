import { z } from "zod";

import { jsonValueSchema, timestampsSchema } from "./common.js";
import { projectLocationSchema } from "./project.js";

export const workSessionCreateSchema = z.object({ workspaceId: z.uuid() });
export const progressStepSchema = z.object({
  step: z.string(),
  at: z.string(),
  detail: z.string().optional(),
});
export const projectBranchSchema = z.object({
  branch: z
    .string()
    .trim()
    .min(1)
    .max(200)
    // A ref name git would reject, or one that could be read as an option.
    .refine(
      (value) =>
        !/[\s~^:?*[\\]/.test(value) &&
        !value.startsWith("-") &&
        !value.includes("..") &&
        !value.endsWith("/") &&
        !value.endsWith(".lock"),
      "Enter a valid branch name",
    ),
});
export const sourceSnapshotSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  kind: z.enum(["git", "database", "other"]),
  config: jsonValueSchema,
});
export const workSessionResponseSchema = z
  .object({
    id: z.uuid(),
    organizationId: z.uuid(),
    workspaceId: z.uuid(),
    createdByUserId: z.string(),
    status: z.enum(["pending", "materializing", "ready", "failed"]),
    sourcesSnapshot: z.array(sourceSnapshotSchema),
    dataSnapshot: z.record(z.string(), jsonValueSchema),
    secretKeys: z.array(z.string()),
    projectBranch: z.string().nullable(),
    projectLocation: projectLocationSchema.nullable(),
    progress: z.array(progressStepSchema),
    failureCode: z.string().nullable(),
  })
  .extend(timestampsSchema.shape);
