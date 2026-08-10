import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createLocalProjectBuilder } from "../git/local-project-builder.js";

const run = promisify(execFile);
const identity = ["-c", "user.name=Test", "-c", "user.email=test@example.test"];

/** A real repository on disk, so the builder is tested against real git. */
async function repositoryWithOneCommit(root: string, name: string) {
  const path = join(root, name);
  await run("git", [...identity, "init", "--initial-branch", "main", path]);
  await writeFile(join(path, "README.md"), `# ${name}\n`);
  await run("git", [...identity, "add", "."], { cwd: path });
  await run("git", [...identity, "commit", "--message", "first"], {
    cwd: path,
  });
  return path;
}

async function currentBranch(path: string) {
  const { stdout } = await run("git", ["branch", "--show-current"], {
    cwd: path,
  });
  return stdout.trim();
}

describe("createLocalProjectBuilder", () => {
  let root = "";
  let remotes: string[] = [];

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "wwsa-builder-"));
    remotes = [
      await repositoryWithOneCommit(root, "engine"),
      await repositoryWithOneCommit(root, "notes"),
    ];
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("builds a project holding each repository as a submodule on the branch", async () => {
    const builder = createLocalProjectBuilder(join(root, "projects"));

    const location = await builder.build({
      workSessionId: "11111111-1111-4111-8111-111111111111",
      workspaceName: "Reporting Team",
      repositories: [
        { name: "engine", remote: remotes[0]! },
        { name: "notes", remote: remotes[1]! },
      ],
      branch: "session/abc",
    });

    expect(location.kind).toBe("local");
    if (location.kind !== "local") throw new Error("expected a local project");
    // The workspace name is a readable directory, the session id keeps it unique.
    expect(location.path).toContain("reporting-team");
    expect(location.path).toContain("11111111-1111-4111-8111-111111111111");

    const { stdout } = await run("git", ["submodule", "status"], {
      cwd: location.path,
    });
    expect(stdout).toContain("engine");
    expect(stdout).toContain("notes");

    // The claim that replaces the manifest decision: submodules are checked out
    // on a branch, not detached, so the first edit-and-commit works.
    for (const name of ["engine", "notes"])
      expect(await currentBranch(join(location.path, name))).toBe(
        "session/abc",
      );
  });

  it("rebuilds over a previous attempt, so a retried job is idempotent", async () => {
    const builder = createLocalProjectBuilder(join(root, "retried"));
    const input = {
      workSessionId: "22222222-2222-4222-8222-222222222222",
      workspaceName: "Retry",
      repositories: [{ name: "engine", remote: remotes[0]! }],
      branch: "session/retry",
    };

    const first = await builder.build(input);
    const second = await builder.build(input);

    expect(second).toEqual(first);
    if (second.kind !== "local") throw new Error("expected a local project");
    const { stdout } = await run("git", ["submodule", "status"], {
      cwd: second.path,
    });
    // Exactly one submodule: the rebuild replaced the project, not appended to it.
    expect(stdout.trim().split("\n")).toHaveLength(1);
  });

  it("moves every submodule onto a new branch on request", async () => {
    const builder = createLocalProjectBuilder(join(root, "branched"));
    const location = await builder.build({
      workSessionId: "33333333-3333-4333-8333-333333333333",
      workspaceName: "Branching",
      repositories: [
        { name: "engine", remote: remotes[0]! },
        { name: "notes", remote: remotes[1]! },
      ],
      branch: "session/first",
    });

    await builder.branchAll(location, "feature/login");

    if (location.kind !== "local") throw new Error("expected a local project");
    for (const name of ["engine", "notes"])
      expect(await currentBranch(join(location.path, name))).toBe(
        "feature/login",
      );
  });

  it("builds an empty project for a workspace with no repositories", async () => {
    const builder = createLocalProjectBuilder(join(root, "empty"));

    const location = await builder.build({
      workSessionId: "44444444-4444-4444-8444-444444444444",
      workspaceName: "Empty",
      repositories: [],
      branch: "session/empty",
    });

    if (location.kind !== "local") throw new Error("expected a local project");
    expect(await currentBranch(location.path)).toBe("session/empty");

    // Nothing to branch is not a failure: there is no `.gitmodules` to read.
    await expect(
      builder.branchAll(location, "feature/login"),
    ).resolves.toBeUndefined();
  });

  it("refuses to branch a project that is not on this machine", async () => {
    const builder = createLocalProjectBuilder(join(root, "elsewhere"));

    await expect(
      builder.branchAll(
        { kind: "s3", bucket: "sessions", prefix: "abc" },
        "feature/login",
      ),
    ).rejects.toThrow(/not on this machine/);
  });

  it("fails rather than prompting for a repository it cannot reach", async () => {
    const builder = createLocalProjectBuilder(join(root, "unreachable"));

    await expect(
      builder.build({
        workSessionId: "55555555-5555-4555-8555-555555555555",
        workspaceName: "Unreachable",
        repositories: [
          { name: "missing", remote: join(root, "no-such-repository") },
        ],
        branch: "session/missing",
      }),
    ).rejects.toThrow(/Could not run git/);
  });
});
