import { z } from "zod";

import { jsonValueSchema, timestampsSchema } from "./common.js";

export const sourceInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  kind: z.enum(["git", "database", "other"]),
  config: jsonValueSchema,
});
export const sourceResponseSchema = sourceInputSchema
  .extend({ id: z.uuid(), organizationId: z.uuid() })
  .extend(timestampsSchema.shape);
export type SourceInput = z.infer<typeof sourceInputSchema>;
