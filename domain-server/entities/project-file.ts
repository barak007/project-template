import { z } from "zod";

/**
 * Where in a session's project to look. Relative and slash-separated; empty is
 * the project root. What the path may contain is enforced where it is resolved
 * ([local-project-files.ts](../git/local-project-files.ts)), because "inside the
 * project" is a property of the project, not of the string.
 */
export const projectPathQuerySchema = z.object({
  path: z.string().max(1000).default(""),
});

export const projectEntryResponseSchema = z.object({
  name: z.string(),
  path: z.string(),
  kind: z.enum(["file", "directory"]),
});

export const projectFileResponseSchema = z.object({
  path: z.string(),
  text: z.string(),
  /** True when the file was longer than a viewer is given; the head is shown. */
  truncated: z.boolean(),
});
