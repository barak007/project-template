import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

import { z } from "zod";

import type { JsonValue } from "../db/schema.js";
import { AppError } from "../errors.js";

import type { GitProvider, RemoteRepository } from "./provider.js";

const localConfigSchema = z.object({ rootPath: z.string().trim().min(1) });

/** `~` is what a person types; every path is stored resolved and absolute. */
function expand(rootPath: string): string {
  if (rootPath === "~") return homedir();
  if (rootPath.startsWith("~/")) return join(homedir(), rootPath.slice(2));
  return resolve(rootPath);
}

function parse(config: JsonValue): string {
  const parsed = localConfigSchema.safeParse(config);
  if (!parsed.success)
    throw new AppError(
      "VALIDATION_FAILED",
      "A local connection needs a rootPath",
      400,
    );
  return expand(parsed.data.rootPath);
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Repositories that already exist on this machine — the provider that needs
 * no account, no token, and no network. It works because "we start local"
 * means the server runs on the same machine as the person using it; a
 * deployed installation would only ever register the hosted providers.
 */
export function createLocalGitProvider(): GitProvider {
  return {
    connect: async (config) => {
      const rootPath = parse(config);
      if (!(await isDirectory(rootPath)))
        throw new AppError(
          "VALIDATION_FAILED",
          "That folder does not exist on this machine",
          400,
        );
      return { label: rootPath, config: { rootPath } };
    },

    listRepositories: async (config) => {
      const rootPath = parse(config);
      let entries;
      try {
        entries = await readdir(rootPath, { withFileTypes: true });
      } catch {
        // A folder that has since been moved or unmounted is an empty list,
        // not a failure: the connection is still what the user asked for.
        return [];
      }
      const found: RemoteRepository[] = [];
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const path = join(rootPath, entry.name);
        // A worktree's .git is a file, not a directory, so this checks only
        // that it is there.
        if (!(await exists(join(path, ".git")))) continue;
        found.push({ externalId: entry.name, name: entry.name, remote: path });
      }
      return found.sort((one, other) => one.name.localeCompare(other.name));
    },
  };
}
