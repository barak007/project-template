import { z } from "zod";

import { jsonValueSchema, keySchema, timestampsSchema } from "./common.js";

export const secretInputSchema = z.object({
  key: keySchema,
  value: z.string().min(1).max(65_536),
});
export const secretResponseSchema = z
  .object({ id: z.uuid(), key: keySchema })
  .extend(timestampsSchema.shape);
export const dataInputSchema = z.object({
  key: keySchema,
  value: jsonValueSchema,
});
export const dataResponseSchema = z
  .object({ id: z.uuid(), key: keySchema, value: jsonValueSchema })
  .extend(timestampsSchema.shape);
export type SecretInput = z.infer<typeof secretInputSchema>;
export type DataInput = z.infer<typeof dataInputSchema>;
