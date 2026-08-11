import { mkdtemp, mkdir, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import type { ProjectLocation } from "../db/schema.js";
import { createLocalProjectFiles } from "../git/local-project-files.js";

const files = createLocalProjectFiles();
let location: ProjectLocation;
let outside = "";

beforeAll(async () => {
  const root = await mkdtemp(join(tmpdir(), "wwsa-local-files-"));
  outside = join(root, "outside.txt");
  await writeFile(outside, "not yours\n", "utf8");
  const project = join(root, "project");
  await mkdir(join(project, "src"), { recursive: true });
  await writeFile(join(project, "src", "small.ts"), "ok\n", "utf8");
  // Longer than a viewer is given, so reading it has to cut off rather than fail.
  await writeFile(join(project, "big.txt"), "x".repeat(600 * 1024), "utf8");
  await symlink(outside, join(project, "escape.txt"));
  location = { kind: "local", path: project };
});

describe("a project's files on this machine", () => {
  it("shows the head of a file too long to open whole", async () => {
    const file = await files.readFile(location, "big.txt");

    expect(file.truncated).toBe(true);
    expect(file.text.length).toBe(512 * 1024);
  });

  it("refuses a symlink pointing out of the project", async () => {
    // The name is inside; what it resolves to is not, which is the case a
    // string check on the path alone would miss.
    await expect(files.readFile(location, "escape.txt")).rejects.toMatchObject({
      status: 404,
    });
  });

  it("refuses a folder asked for as a file, and a file asked for as a folder", async () => {
    await expect(files.readFile(location, "src")).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      files.listDirectory(location, "src/small.ts"),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("is a 404 for something that is not there, and a 400 for no name at all", async () => {
    await expect(files.readFile(location, "src/gone.ts")).rejects.toMatchObject(
      {
        status: 404,
      },
    );
    await expect(files.readFile(location, "")).rejects.toMatchObject({
      status: 400,
    });
  });

  it("cannot read a project that is not on this machine", async () => {
    const bucket: ProjectLocation = {
      kind: "s3",
      bucket: "sessions",
      prefix: "a/b",
    };

    await expect(files.listDirectory(bucket, "")).rejects.toMatchObject({
      status: 400,
    });
  });
});
