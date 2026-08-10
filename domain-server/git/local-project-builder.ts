import { execFile } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import type { ProjectLocation } from "../db/schema.js";
import { AppError } from "../errors.js";

import type {
  BuildProjectInput,
  WorkspaceProjectBuilder,
} from "./project-builder.js";

const run = promisify(execFile);

/**
 * The project is machinery, so it commits as the product rather than as
 * whoever's git identity happens to be configured — and a machine with no
 * `user.email` set at all would otherwise fail to commit.
 */
const identity = [
  "-c",
  "user.name=What We Sure About",
  "-c",
  "user.email=sessions@wwsa.local",
];

/**
 * Builds the session's project as a directory on the machine running the
 * server. Valid because "we start local" means the server and the person using
 * it share a machine; a deployed installation registers a bucket-backed builder
 * instead.
 *
 * Cloning uses whatever git credentials that machine already has, so no token
 * ever reaches this process.
 */
export function createLocalProjectBuilder(
  root: string,
): WorkspaceProjectBuilder {
  return {
    build: async (input: BuildProjectInput): Promise<ProjectLocation> => {
      const path = join(root, slug(input.workspaceName), input.workSessionId);
      // Rebuilding from scratch is what makes a retried job idempotent: the
      // directory is derived from the session id, so a half-built one is waste,
      // never state to preserve.
      await rm(path, { recursive: true, force: true });
      await mkdir(path, { recursive: true });

      await git(path, ["init", "--initial-branch", input.branch]);
      // Submodules of a repository with no commit have nowhere to be recorded.
      await git(path, ["commit", "--allow-empty", "--message", "Workspace"]);
      for (const repository of input.repositories) {
        await git(path, [
          "-c",
          "protocol.file.allow=always",
          "submodule",
          "add",
          "--force",
          ...(repository.ref ? ["--branch", repository.ref] : []),
          repository.remote,
          repository.name,
        ]);
      }
      if (input.repositories.length > 0) {
        // A source's `ref` is where its work starts, not where it stays: the
        // submodule is cloned at that ref and the session branch is cut from it.
        await branchSubmodules(path, input.repositories, input.branch);
        await git(path, ["add", "."]);
        await git(path, [
          "commit",
          "--message",
          `Add ${input.repositories.length} repositories`,
        ]);
      }
      return { kind: "local", path };
    },

    branchAll: async (location: ProjectLocation, branch: string) => {
      if (location.kind !== "local")
        throw new AppError(
          "VALIDATION_FAILED",
          "This session's project is not on this machine",
          400,
        );
      const names = await submoduleNames(location.path);
      await branchSubmodules(
        location.path,
        names.map((name) => ({ name })),
        branch,
      );
    },
  };
}

async function branchSubmodules(
  path: string,
  repositories: { name: string }[],
  branch: string,
) {
  for (const repository of repositories) {
    const workingDirectory = join(path, repository.name);
    // `checkout -B` both creates the branch and moves onto it, which is the one
    // command that behaves the same whether or not the branch already exists.
    await git(workingDirectory, ["checkout", "-B", branch]);
  }
}

async function submoduleNames(path: string): Promise<string[]> {
  // `--get-regexp` exits 1 when nothing matches, and a project built from a
  // workspace with no repositories has no `.gitmodules` at all. Both mean "no
  // submodules", which is an empty list rather than a failed command.
  let stdout: string;
  try {
    ({ stdout } = await git(path, [
      "config",
      "--file",
      ".gitmodules",
      "--get-regexp",
      "path",
    ]));
  } catch {
    return [];
  }
  return stdout
    .split("\n")
    .map((line) => line.trim().split(" ").slice(1).join(" "))
    .filter((name) => name.length > 0);
}

/**
 * Never a shell: `execFile` passes arguments as an array, so a remote URL
 * cannot become another command. Git's own stderr is not surfaced to the
 * caller, per the rule against upstream exception text in messages.
 */
async function git(cwd: string, parameters: string[]) {
  try {
    return await run("git", [...identity, ...parameters], {
      cwd,
      env: {
        ...process.env,
        // A prompt would hang the worker forever; a repository needing
        // credentials this machine does not have should fail instead.
        GIT_TERMINAL_PROMPT: "0",
        GIT_ASKPASS: "echo",
      },
    });
  } catch {
    throw new AppError(
      "INTERNAL_ERROR",
      `Could not run git ${parameters[0] ?? ""}`.trim(),
      500,
    );
  }
}

function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "workspace"
  );
}
