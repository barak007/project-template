import { execFile } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import type { ProjectLocation } from "../db/schema.js";
import { AppError } from "../errors.js";
import type { Logger } from "../logging.js";
import { silentLogger } from "../logging.js";

import type {
  CloneForSessionInput,
  EnsureProjectInput,
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
 * Submodules whose remote is a local path are refused by default. Every clone
 * here is of a project this server built, which is exactly that case.
 */
const allowLocalClones = ["-c", "protocol.file.allow=always"];

/** What a project's `.gitmodules` says it contains. */
type Submodule = { name: string; path: string; remote: string };

/**
 * Builds workspace projects and session clones as directories on the machine
 * running the server. Valid because "we start local" means the server and the
 * person using it share a machine; a deployed installation registers a
 * bucket-backed builder instead.
 *
 * Cloning uses whatever git credentials that machine already has, so no token
 * ever reaches this process.
 */
export function createLocalProjectBuilder(
  root: string,
  log: Logger = silentLogger,
): WorkspaceProjectBuilder {
  return {
    ensureWorkspaceProject: async (
      input: EnsureProjectInput,
    ): Promise<ProjectLocation> => {
      const path = join(workspaceDirectory(root, input), "project");
      const existing = await isRepository(path);

      if (!existing) {
        await input.report("Creating the workspace project", path);
        await rm(path, { recursive: true, force: true });
        await mkdir(path, { recursive: true });
        await git(log, path, ["init", "--initial-branch", "main"]);
        // Submodules of a repository with no commit have nowhere to be recorded.
        await git(log, path, [
          "commit",
          "--allow-empty",
          "--message",
          "Workspace project",
        ]);
      } else {
        await input.report("Reusing the workspace project", path);
      }

      await reconcile(log, path, input);
      return { kind: "local", path };
    },

    cloneForSession: async (
      input: CloneForSessionInput,
    ): Promise<ProjectLocation> => {
      if (input.project.kind !== "local")
        throw new AppError(
          "VALIDATION_FAILED",
          "This workspace's project is not on this machine",
          400,
        );
      // Beside the project rather than derived again from the workspace, so the
      // two can never disagree about where this workspace lives.
      const path = join(
        input.project.path,
        "..",
        "sessions",
        input.workSessionId,
      );
      // The directory is derived from the session id, so a retried job throws
      // away its own half-finished clone rather than trying to repair it.
      await rm(path, { recursive: true, force: true });
      await mkdir(join(path, ".."), { recursive: true });
      await input.report("Cloning the workspace project", path);

      // `--recurse-submodules` is what makes a second session cheap: the
      // submodules come from the project on disk, not from their hosts.
      await git(log, join(path, ".."), [
        ...allowLocalClones,
        "clone",
        "--recurse-submodules",
        input.project.path,
        path,
      ]);
      await git(log, path, ["checkout", "-B", input.branch]);

      const submodules = await readSubmodules(log, path);
      if (submodules.length > 0) {
        await input.report(
          `Putting ${String(submodules.length)} repositories on ${input.branch}`,
        );
        await branchSubmodules(log, path, submodules, input.branch);
      }
      await input.report("Session ready", path);
      return { kind: "local", path };
    },

    branchAll: async (location: ProjectLocation, branch: string) => {
      if (location.kind !== "local")
        throw new AppError(
          "VALIDATION_FAILED",
          "This session's project is not on this machine",
          400,
        );
      const submodules = await readSubmodules(log, location.path);
      await branchSubmodules(log, location.path, submodules, branch);
    },
  };
}

/**
 * Makes the project's submodules match the workspace exactly. This is the
 * structure the product enforces: **one submodule per repository, at a
 * directory named after it, pointing at its remote.** Anything else — a
 * repository removed from the workspace, a remote that changed, a name reused —
 * is corrected here rather than surfacing later as a session that holds the
 * wrong code.
 */
async function reconcile(log: Logger, path: string, input: EnsureProjectInput) {
  const present = await readSubmodules(log, path);
  const wanted = new Map(
    input.repositories.map((repository) => [repository.name, repository]),
  );

  const stale = present.filter((submodule) => {
    // A submodule at the wrong path is as wrong as one with the wrong remote:
    // the session's folder layout is part of what a user is promised.
    if (submodule.path !== submodule.name) return true;
    return wanted.get(submodule.name)?.remote !== submodule.remote;
  });
  const added = input.repositories.filter(
    (repository) =>
      !present.some(
        (submodule) =>
          submodule.name === repository.name &&
          submodule.remote === repository.remote &&
          submodule.path === submodule.name,
      ),
  );
  if (stale.length === 0 && added.length === 0) {
    log.debug("workspace project already matches the workspace", { path });
    return;
  }

  for (const submodule of stale) {
    await input.report(`Removing ${submodule.name}`);
    await removeSubmodule(log, path, submodule);
  }
  let cloned = 0;
  for (const repository of added) {
    cloned += 1;
    await input.report(
      `Cloning ${repository.name} (${String(cloned)} of ${String(added.length)})`,
      repository.remote,
    );
    await git(log, path, [
      ...allowLocalClones,
      "submodule",
      "add",
      "--force",
      ...(repository.ref ? ["--branch", repository.ref] : []),
      repository.remote,
      repository.name,
    ]);
  }

  await git(log, path, ["add", "--all"]);
  await git(log, path, [
    "commit",
    "--allow-empty",
    "--message",
    `${String(added.length)} added, ${String(stale.length)} removed`,
  ]);
  log.info("workspace project reconciled", {
    path,
    added: added.length,
    removed: stale.length,
  });
}

/**
 * `git submodule deinit` and `rm` leave the entry in `.git/modules`, which makes
 * re-adding the same name fail. Clearing it is what lets a repository be removed
 * and added back.
 */
async function removeSubmodule(
  log: Logger,
  path: string,
  submodule: Submodule,
) {
  await git(log, path, [
    "submodule",
    "deinit",
    "--force",
    submodule.path,
  ]).catch(() => undefined);
  await git(log, path, ["rm", "--force", submodule.path]).catch(
    () => undefined,
  );
  await rm(join(path, submodule.path), { recursive: true, force: true });
  await rm(join(path, ".git", "modules", submodule.name), {
    recursive: true,
    force: true,
  });
}

async function branchSubmodules(
  log: Logger,
  path: string,
  submodules: { path: string }[],
  branch: string,
) {
  for (const submodule of submodules) {
    // `checkout -B` both creates the branch and moves onto it, which is the one
    // command that behaves the same whether or not the branch already exists.
    await git(log, join(path, submodule.path), ["checkout", "-B", branch]);
  }
}

/**
 * The project's declared structure. `--get-regexp` exits 1 when nothing
 * matches, and a project with no repositories has no `.gitmodules` at all —
 * both mean "no submodules", which is an empty list rather than a failure.
 */
async function readSubmodules(log: Logger, path: string): Promise<Submodule[]> {
  let stdout: string;
  try {
    ({ stdout } = await git(log, path, [
      "config",
      "--file",
      ".gitmodules",
      "--list",
    ]));
  } catch {
    return [];
  }

  const paths = new Map<string, string>();
  const remotes = new Map<string, string>();
  for (const line of stdout.split("\n")) {
    const match = /^submodule\.(.+)\.(path|url)=(.*)$/.exec(line.trim());
    if (!match) continue;
    const [, name, key, value] = match;
    if (!name || !value) continue;
    (key === "path" ? paths : remotes).set(name, value);
  }
  return [...paths].map(([name, submodulePath]) => ({
    name,
    path: submodulePath,
    remote: remotes.get(name) ?? "",
  }));
}

async function isRepository(path: string): Promise<boolean> {
  try {
    const { stdout } = await run(
      "git",
      ["rev-parse", "--is-inside-work-tree"],
      {
        cwd: path,
      },
    );
    return stdout.trim() === "true";
  } catch {
    return false;
  }
}

/** Readable, and stable across a rename: the id is what actually identifies it. */
function workspaceDirectory(
  root: string,
  input: { workspaceName: string; workspaceId: string },
): string {
  return join(
    root,
    `${slug(input.workspaceName)}-${input.workspaceId.slice(0, 8)}`,
  );
}

/**
 * Never a shell: `execFile` passes arguments as an array, so a remote URL
 * cannot become another command. Git's own stderr is not surfaced to the
 * caller, per the rule against upstream exception text in messages.
 */
async function git(log: Logger, cwd: string, parameters: string[]) {
  const started = Date.now();
  log.debug("git", { command: parameters.join(" "), cwd });
  try {
    const result = await run("git", [...identity, ...parameters], {
      cwd,
      env: {
        ...process.env,
        // A prompt would hang the worker forever; a repository needing
        // credentials this machine does not have should fail instead.
        GIT_TERMINAL_PROMPT: "0",
        GIT_ASKPASS: "echo",
      },
    });
    log.debug("git finished", {
      command: parameters[0] ?? "",
      ms: Date.now() - started,
    });
    return result;
  } catch (error) {
    // The reason git failed is what a developer needs and a user must never
    // see, so it goes to the log and not into the AppError.
    log.error("git failed", {
      command: parameters.join(" "),
      cwd,
      ms: Date.now() - started,
      reason: error instanceof Error ? error.message : String(error),
    });
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
