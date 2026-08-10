import { z } from "zod";

import { jsonValueSchema, timestampsSchema } from "./common.js";

export const connectionProviderSchema = z.enum(["local", "github"]);
export type ConnectionProviderName = z.infer<typeof connectionProviderSchema>;

/**
 * `config` is opaque here on purpose: each provider validates its own shape
 * in `connect`, so adding GitHub does not change this schema.
 */
export const connectionInputSchema = z.object({
  provider: connectionProviderSchema,
  config: jsonValueSchema,
});
export const connectionResponseSchema = z
  .object({
    id: z.uuid(),
    organizationId: z.uuid(),
    provider: connectionProviderSchema,
    label: z.string(),
    config: jsonValueSchema,
  })
  .extend(timestampsSchema.shape);
export type ConnectionInput = z.infer<typeof connectionInputSchema>;
