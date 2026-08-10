import { z } from "zod";

/** A repository a connection exposes, before anything imports it. */
export const repositoryResponseSchema = z.object({
  connectionId: z.uuid(),
  externalId: z.string(),
  name: z.string(),
  remote: z.string(),
});

export const repositoryImportSchema = z.object({
  connectionId: z.uuid(),
  externalId: z.string().min(1).max(400),
});
export type RepositoryImport = z.infer<typeof repositoryImportSchema>;
