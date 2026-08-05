import { z } from "zod";

import { timestampsSchema } from "./common.js";

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
  })
  .extend(timestampsSchema.shape);
export type WorkspaceInput = z.infer<typeof workspaceInputSchema>;
