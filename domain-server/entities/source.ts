import { z } from "zod";

import { jsonValueSchema, timestampsSchema } from "./common.js";
import { gitRemoteSchema } from "./repository.js";

/**
 * What a `git` source's `config` must hold. Validated here rather than left to
 * `jsonValueSchema` because the project builder clones `remote` — a source that
 * cannot be cloned is a session that fails at materialization instead of a
 * request that fails at the edge.
 */
export const gitSourceConfigSchema = z.object({
  remote: gitRemoteSchema,
  ref: z.string().trim().min(1).max(200).optional(),
});
export type GitSourceConfig = z.infer<typeof gitSourceConfigSchema>;

export const sourceInputSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    kind: z.enum(["git", "database", "other"]),
    config: jsonValueSchema,
  })
  .superRefine((input, context) => {
    if (input.kind !== "git") return;
    const parsed = gitSourceConfigSchema.safeParse(input.config);
    if (parsed.success) return;
    for (const issue of parsed.error.issues)
      context.addIssue({ ...issue, path: ["config", ...issue.path] });
  });

export const sourceResponseSchema = z
  .object({
    name: z.string(),
    kind: z.enum(["git", "database", "other"]),
    config: jsonValueSchema,
    id: z.uuid(),
    organizationId: z.uuid(),
  })
  .extend(timestampsSchema.shape);
export type SourceInput = z.infer<typeof sourceInputSchema>;
