import { readdir, readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, join, resolve, sep } from "node:path";

import type { ProjectLocation } from "../db/schema.js";
import { AppError } from "../errors.js";

import type {
  ProjectEntry,
  ProjectFile,
  ProjectFiles,
} from "./project-files.js";

/** Enough to read any source file; a bigger one opens truncated, not refused. */
const maxFileBytes = 512 * 1024;

/**
 * A session's project as directories on the machine running the server — the
 * local half of the [ProjectFiles](./project-files.ts) port, paired with
 * [local-project-builder.ts](./local-project-builder.ts).
 *
 * Only the server ever touches these paths: every caller reaches this through
 * the API, so browsing a session works the same from another machine.
 */
export function createLocalProjectFiles(): ProjectFiles {
  return {
    listDirectory: async (
      location: ProjectLocation,
      path: string,
    ): Promise<ProjectEntry[]> => {
      const target = await insideProject(location, path);
      const entries = await readdir(target, { withFileTypes: true }).catch(
        (error: unknown) => {
          throw notFound(error, "Directory not found");
        },
      );
      return (
        entries
          .filter((entry) => entry.name !== ".git")
          .map((entry) => ({
            name: entry.name,
            path: path === "" ? entry.name : `${path}/${entry.name}`,
            kind: entry.isDirectory()
              ? ("directory" as const)
              : ("file" as const),
          }))
          // Directories first, then alphabetical: the order a file tree is read in.
          .sort((left, right) =>
            left.kind === right.kind
              ? left.name.localeCompare(right.name)
              : left.kind === "directory"
                ? -1
                : 1,
          )
      );
    },

    readFile: async (
      location: ProjectLocation,
      path: string,
    ): Promise<ProjectFile> => {
      if (path === "")
        throw new AppError("VALIDATION_FAILED", "Name a file to read", 400);
      const target = await insideProject(location, path);
      const info = await stat(target).catch((error: unknown) => {
        throw notFound(error, "File not found");
      });
      if (info.isDirectory())
        throw new AppError("VALIDATION_FAILED", "That path is a folder", 400);

      const bytes = await readFile(target).catch((error: unknown) => {
        throw notFound(error, "File not found");
      });
      const head = bytes.subarray(0, maxFileBytes);
      // A NUL byte in the part being shown is what every editor treats as
      // "not text"; guessing from the extension would be wrong more often.
      if (head.includes(0))
        throw new AppError(
          "VALIDATION_FAILED",
          "This file is not text and cannot be shown",
          400,
        );
      return {
        path,
        text: head.toString("utf8"),
        truncated: bytes.byteLength > head.byteLength,
      };
    },
  };
}

/**
 * The path resolved under the project root, or a refusal. A path arrives from a
 * browser, so `..`, an absolute path and a symlink out of the tree all have to
 * be treated as attempts to read the rest of the machine.
 */
async function insideProject(
  location: ProjectLocation,
  path: string,
): Promise<string> {
  if (location.kind !== "local")
    throw new AppError(
      "VALIDATION_FAILED",
      "This session's project is not on this machine",
      400,
    );
  if (isAbsolute(path) || path.split("/").includes(".."))
    throw new AppError("NOT_FOUND", "Path not found in this project", 404);

  // Resolved through symlinks on both sides, because a link inside the project
  // can point anywhere on the machine and comparing the strings would miss it.
  const root = await realpath(resolve(location.path)).catch(
    (error: unknown) => {
      throw notFound(error, "This session's project is gone");
    },
  );
  const target = await realpath(
    resolve(root, join(...path.split("/").filter(Boolean)) || "."),
  ).catch((error: unknown) => {
    throw notFound(error, "Path not found in this project");
  });
  if (target !== root && !target.startsWith(root + sep))
    throw new AppError("NOT_FOUND", "Path not found in this project", 404);
  return target;
}

/**
 * A missing path is a `404`; anything else about the filesystem is ours and
 * never becomes part of a message.
 */
function notFound(error: unknown, message: string): AppError {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === "ENOENT" || code === "ENOTDIR")
    return new AppError("NOT_FOUND", message, 404);
  return new AppError("INTERNAL_ERROR", "Could not read the project", 500);
}
