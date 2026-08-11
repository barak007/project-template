import { z } from "zod";

/**
 * Where a git project lives. A shape rather than a path, because the answer
 * changes per installation — a directory on the machine that built it today, a
 * bucket once this runs in the cloud — while everything above the port stays the
 * same. Both a workspace's project and a session's clone of it are one of these.
 */
export const projectLocationSchema = z.union([
  z.object({ kind: z.literal("local"), path: z.string() }),
  z.object({
    kind: z.literal("s3"),
    bucket: z.string(),
    prefix: z.string(),
  }),
]);

/**
 * Where in a project to look. Relative and slash-separated; empty is the project
 * root. What the path may contain is enforced where it is resolved
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
