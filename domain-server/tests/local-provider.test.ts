import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppError } from "../errors.js";
import { createLocalGitProvider } from "../git/local-provider.js";

const provider = createLocalGitProvider();
let root = "";

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "wwsa-local-provider-"));
  await mkdir(join(root, "engine", ".git"), { recursive: true });
  await mkdir(join(root, "atlas"), { recursive: true });
  // A worktree's .git is a file, and it is still a repository.
  await mkdir(join(root, "worktree"), { recursive: true });
  await writeFile(join(root, "worktree", ".git"), "gitdir: /elsewhere");
  await mkdir(join(root, "notes"), { recursive: true });
  await writeFile(join(root, "loose-file"), "not a directory");
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("the local git provider", () => {
  it("accepts a folder that exists and reports it as the label", async () => {
    expect(await provider.connect({ rootPath: root })).toEqual({
      label: root,
      config: { rootPath: root },
    });
  });

  it("expands a leading ~ to the home directory", async () => {
    const account = await provider.connect({ rootPath: "~" });
    expect(account.label).toBe(homedir());
  });

  it("refuses a folder that does not exist", async () => {
    await expect(
      provider.connect({ rootPath: join(root, "missing") }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("refuses a config without a rootPath", async () => {
    await expect(provider.connect({ nope: true })).rejects.toBeInstanceOf(
      AppError,
    );
  });

  it("lists only repositories, sorted, with the folder as the remote", async () => {
    const repositories = await provider.listRepositories({ rootPath: root });
    expect(repositories.map((one) => one.name)).toEqual(["engine", "worktree"]);
    expect(repositories[0]).toEqual({
      externalId: "engine",
      name: "engine",
      remote: join(root, "engine"),
    });
  });

  it("treats a folder that has since disappeared as empty, not broken", async () => {
    expect(
      await provider.listRepositories({ rootPath: join(root, "missing") }),
    ).toEqual([]);
  });
});
