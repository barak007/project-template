import { execFile } from "node:child_process";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ProjectLocation } from "../db/schema.js";
import { createLocalProjectBuilder } from "../git/local-project-builder.js";
import type { ProjectRepository } from "../git/project-builder.js";

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

async function submoduleNames(path: string) {
  const { stdout } = await run(
    "git",
    ["config", "--file", ".gitmodules", "--get-regexp", "path"],
    { cwd: path },
  ).catch(() => ({ stdout: "" }));
  return stdout
    .split("\n")
    .map((line) => line.trim().split(" ")[1] ?? "")
    .filter((name) => name.length > 0)
    .sort();
}

/** The commit a submodule is pinned to, straight out of the project's index. */
async function gitlink(path: string, name: string) {
  const { stdout } = await run("git", ["ls-files", "--stage", name], {
    cwd: path,
  });
  return stdout.trim().split(/\s+/)[1] ?? "";
}

async function headCommit(repository: string, ref = "HEAD") {
  const { stdout } = await run("git", ["rev-parse", ref], { cwd: repository });
  return stdout.trim();
}

function localPath(location: ProjectLocation) {
  if (location.kind !== "local") throw new Error("expected a local project");
  return location.path;
}

/** Steps are the product's answer to "what is happening right now". */
function collector() {
  const steps: string[] = [];
  return {
    steps,
    report: (step: string) => {
      steps.push(step);
      return Promise.resolve();
    },
  };
}

describe("createLocalProjectBuilder", () => {
  let root = "";
  let engine = "";
  let notes = "";
  let extra = "";

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "wwsa-builder-"));
    engine = await repositoryWithOneCommit(root, "engine");
    notes = await repositoryWithOneCommit(root, "notes");
    extra = await repositoryWithOneCommit(root, "extra");
    // A second ref, so "the workspace changed which branch it wants" is testable.
    await run("git", [...identity, "branch", "release"], { cwd: engine });
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  function builderIn(directory: string) {
    return createLocalProjectBuilder(join(root, directory));
  }

  function ensure(
    builder: ReturnType<typeof builderIn>,
    workspaceId: string,
    repositories: ProjectRepository[],
    report = collector().report,
  ) {
    return builder.ensureWorkspaceProject({
      workspaceId,
      workspaceName: "Reporting Team",
      repositories,
      report,
    });
  }

  it("declares one submodule per repository without cloning any of them", async () => {
    const builder = builderIn("built");
    const { steps, report } = collector();

    const project = await ensure(
      builder,
      "11111111-1111-4111-8111-111111111111",
      [
        { name: "engine", remote: engine },
        { name: "notes", remote: notes },
      ],
      report,
    );

    const path = localPath(project);
    // Readable directory, stable across a rename because the id is in it.
    expect(path).toContain("reporting-team-11111111");
    expect(path.endsWith("/project")).toBe(true);
    expect(await submoduleNames(path)).toEqual(["engine", "notes"]);
    expect(steps[0]).toBe("Creating the workspace project");
    expect(steps).toContain("Adding engine (1 of 2)");

    // The declaration, not a checkout: no repository content on disk, but a
    // gitlink pinning each one to the commit its ref points at.
    expect(await readdir(path)).toEqual([".git", ".gitmodules"]);
    for (const [name, remote] of [
      ["engine", engine],
      ["notes", notes],
    ] as const)
      expect(await gitlink(path, name)).toBe(await headCommit(remote));
  });

  it("reuses the project on a second call and does no git work", async () => {
    const builder = builderIn("reused");
    const workspaceId = "22222222-2222-4222-8222-222222222222";
    const repositories = [{ name: "engine", remote: engine }];
    const first = await ensure(builder, workspaceId, repositories);

    const { steps, report } = collector();
    const second = await ensure(builder, workspaceId, repositories, report);

    expect(second).toEqual(first);
    expect(steps).toEqual(["Reusing the workspace project"]);
    expect(await submoduleNames(localPath(second))).toEqual(["engine"]);
  });

  it("adds a repository the workspace gained", async () => {
    const builder = builderIn("gained");
    const workspaceId = "33333333-3333-4333-8333-333333333333";
    await ensure(builder, workspaceId, [{ name: "engine", remote: engine }]);

    const project = await ensure(builder, workspaceId, [
      { name: "engine", remote: engine },
      { name: "notes", remote: notes },
    ]);

    expect(await submoduleNames(localPath(project))).toEqual([
      "engine",
      "notes",
    ]);
  });

  it("removes a repository the workspace dropped, directory and all", async () => {
    const builder = builderIn("dropped");
    const workspaceId = "44444444-4444-4444-8444-444444444444";
    await ensure(builder, workspaceId, [
      { name: "engine", remote: engine },
      { name: "notes", remote: notes },
    ]);

    const project = await ensure(builder, workspaceId, [
      { name: "notes", remote: notes },
    ]);

    const path = localPath(project);
    expect(await submoduleNames(path)).toEqual(["notes"]);
    // The working tree matches the declaration; no orphaned folder is left.
    expect(await readdir(path)).not.toContain("engine");
  });

  it("re-points a repository whose remote changed", async () => {
    const builder = builderIn("repointed");
    const workspaceId = "55555555-5555-4555-8555-555555555555";
    await ensure(builder, workspaceId, [{ name: "engine", remote: engine }]);

    // Same name, different repository — the structure must follow the config.
    const project = await ensure(builder, workspaceId, [
      { name: "engine", remote: extra },
    ]);

    const path = localPath(project);
    const { stdout } = await run(
      "git",
      ["config", "--file", ".gitmodules", "--get", "submodule.engine.url"],
      { cwd: path },
    );
    expect(stdout.trim()).toBe(extra);
    expect(await submoduleNames(path)).toEqual(["engine"]);
  });

  it("re-pins a repository whose ref changed", async () => {
    const builder = builderIn("reffed");
    const workspaceId = "18181818-1818-4818-8818-181818181818";
    await ensure(builder, workspaceId, [{ name: "engine", remote: engine }]);

    const project = await ensure(builder, workspaceId, [
      { name: "engine", remote: engine, ref: "release" },
    ]);

    const path = localPath(project);
    const { stdout } = await run(
      "git",
      ["config", "--file", ".gitmodules", "--get", "submodule.engine.branch"],
      { cwd: path },
    );
    expect(stdout.trim()).toBe("release");
    expect(await gitlink(path, "engine")).toBe(
      await headCommit(engine, "release"),
    );
  });

  it("fails rather than pinning a ref the repository does not have", async () => {
    const builder = builderIn("no-such-ref");

    await expect(
      ensure(builder, "19191919-1919-4919-8919-191919191919", [
        { name: "engine", remote: engine, ref: "no-such-branch" },
      ]),
    ).rejects.toThrow(/no no-such-branch branch/);
  });

  it("clones the project for a session, on the session's branch", async () => {
    const builder = builderIn("cloned");
    const project = await ensure(
      builder,
      "66666666-6666-4666-8666-666666666666",
      [
        { name: "engine", remote: engine },
        { name: "notes", remote: notes },
      ],
    );
    const { steps, report } = collector();

    const session = await builder.cloneForSession({
      project,
      workSessionId: "77777777-7777-4777-8777-777777777777",
      branch: "session/77777777",
      report,
    });

    const path = localPath(session);
    // Beside the project, so everything for one workspace lives together.
    expect(path).toContain("/sessions/77777777-7777-4777-8777-777777777777");
    expect(path).not.toBe(localPath(project));
    expect(await currentBranch(path)).toBe("session/77777777");
    expect(await submoduleNames(path)).toEqual(["engine", "notes"]);
    // The code the project only declared is here, checked out, for real.
    expect(await readdir(join(path, "engine"))).toContain("README.md");

    // The claim that justifies submodules: checked out on a branch, not detached,
    // so the first thing a user does — edit a file and commit — works.
    for (const name of ["engine", "notes"])
      expect(await currentBranch(join(path, name))).toBe("session/77777777");
    expect(steps.at(-1)).toBe("Session ready");
  });

  it("gives two sessions on one workspace independent clones", async () => {
    const builder = builderIn("twice");
    const project = await ensure(
      builder,
      "88888888-8888-4888-8888-888888888888",
      [{ name: "engine", remote: engine }],
    );
    const { report } = collector();
    const base = {
      project,
      report,
    };

    const first = await builder.cloneForSession({
      ...base,
      workSessionId: "99999999-9999-4999-8999-999999999991",
      branch: "session/aaaa1111",
    });
    const second = await builder.cloneForSession({
      ...base,
      workSessionId: "99999999-9999-4999-8999-999999999992",
      branch: "session/aaaa2222",
    });

    expect(localPath(first)).not.toBe(localPath(second));
    expect(await currentBranch(localPath(first))).toBe("session/aaaa1111");
    expect(await currentBranch(localPath(second))).toBe("session/aaaa2222");
  });

  it("moves every submodule onto a new branch on request", async () => {
    const builder = builderIn("branched");
    const project = await ensure(
      builder,
      "12121212-1212-4212-8212-121212121212",
      [
        { name: "engine", remote: engine },
        { name: "notes", remote: notes },
      ],
    );
    const { report } = collector();
    const session = await builder.cloneForSession({
      project,
      workSessionId: "13131313-1313-4313-8313-131313131313",
      branch: "session/first",
      report,
    });

    await builder.branchAll(session, "feature/login");

    for (const name of ["engine", "notes"])
      expect(await currentBranch(join(localPath(session), name))).toBe(
        "feature/login",
      );
  });

  it("handles a workspace with no repositories at all", async () => {
    const builder = builderIn("empty");
    const project = await ensure(
      builder,
      "14141414-1414-4414-8414-141414141414",
      [],
    );
    const { report } = collector();

    const session = await builder.cloneForSession({
      project,
      workSessionId: "15151515-1515-4515-8515-151515151515",
      branch: "session/empty",
      report,
    });

    expect(await submoduleNames(localPath(session))).toEqual([]);
    expect(await currentBranch(localPath(session))).toBe("session/empty");
    // Nothing to branch is not a failure.
    await expect(
      builder.branchAll(session, "feature/login"),
    ).resolves.toBeUndefined();
  });

  it("refuses to work on a project that is not on this machine", async () => {
    const builder = builderIn("elsewhere");
    const elsewhere: ProjectLocation = {
      kind: "s3",
      bucket: "sessions",
      prefix: "abc",
    };
    const { report } = collector();

    await expect(
      builder.cloneForSession({
        project: elsewhere,
        workSessionId: "16161616-1616-4616-8616-161616161616",
        branch: "session/x",
        report,
      }),
    ).rejects.toThrow(/not on this machine/);
    await expect(builder.branchAll(elsewhere, "feature/login")).rejects.toThrow(
      /not on this machine/,
    );
  });

  it("fails rather than prompting for a repository it cannot reach", async () => {
    const builder = builderIn("unreachable");

    await expect(
      ensure(builder, "17171717-1717-4717-8717-171717171717", [
        { name: "missing", remote: join(root, "no-such-repository") },
      ]),
    ).rejects.toThrow(/Could not run git/);
  });
});
