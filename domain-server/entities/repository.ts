import { z } from "zod";

/**
 * A repository is a definition: a remote URL, and optionally the ref a session
 * should check out. Nothing needs to be connected, installed, or present on any
 * machine for one to exist — cloning happens when a session materializes it.
 */
export const gitRemoteSchema = z
  .string()
  .trim()
  .min(1)
  .max(400)
  .refine(isCloneableRemote, "Enter a git repository URL");

export const repositoryInputSchema = z.object({
  remote: gitRemoteSchema,
  ref: z.string().trim().min(1).max(200).optional(),
});
export type RepositoryInput = z.infer<typeof repositoryInputSchema>;

/**
 * The forms `git clone` accepts, minus the ones we will not run: a local path
 * is rejected because a repository is not a folder on the server's machine, and
 * `ext::`/`file://` would let a URL choose a program to execute.
 */
function isCloneableRemote(remote: string): boolean {
  if (/^(https?|git|ssh):\/\/[^/]+\/.+/.test(remote)) return true;
  // scp-like syntax, which is what a copied SSH URL looks like: git@host:owner/repo.git
  return /^[\w.-]+@[\w.-]+:[^/].*/.test(remote);
}

/**
 * The last path segment, without `.git` — `bar` from every spelling of
 * `…/foo/bar.git`. What the user recognizes, and what the submodule directory
 * is named inside a session's project.
 */
export function repositoryName(remote: string): string {
  const withoutTrailingSlash = remote.replace(/\/+$/, "");
  const lastSegment = withoutTrailingSlash.split(/[/:]/).pop() ?? "";
  // A URL whose last segment is only `.git` leaves nothing to name it after.
  return lastSegment.replace(/\.git$/, "") || "repository";
}
