import { z } from "zod";

import { jsonValueSchema, timestampsSchema } from "./common.js";

export const workSessionCreateSchema = z.object({ workspaceId: z.uuid() });
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
    failureCode: z.string().nullable(),
  })
  .extend(timestampsSchema.shape);
