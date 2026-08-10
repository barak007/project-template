import { z } from "zod";

import { jsonValueSchema, timestampsSchema } from "./common.js";

export const workSessionCreateSchema = z.object({ workspaceId: z.uuid() });
export const projectLocationSchema = z.union([
  z.object({ kind: z.literal("local"), path: z.string() }),
  z.object({
    kind: z.literal("s3"),
    bucket: z.string(),
    prefix: z.string(),
  }),
]);
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
    failureCode: z.string().nullable(),
  })
  .extend(timestampsSchema.shape);
