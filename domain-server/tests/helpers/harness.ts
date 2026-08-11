import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import { createApp } from "../../app.js";
import { SecretCipher } from "../../crypto/secrets.js";
import type { Database } from "../../db/client.js";
import * as schema from "../../db/schema.js";
import { createLocalProjectFiles } from "../../git/local-project-files.js";
import type { AppBindings, RuntimeDependencies } from "../../http/context.js";
import type { JobProducer } from "../../jobs/queue.js";
import { silentLogger } from "../../logging.js";

import { recordingProjectBuilder } from "./project-builder.js";

const migrationsFolder = fileURLToPath(
  new URL("../../../drizzle", import.meta.url),
);

export const testCipher = new SecretCipher(
  Buffer.alloc(32, 5).toString("base64"),
);

/** In-process Postgres with the real migrations applied. */
export async function createTestDatabase() {
  const pglite = new PGlite();
  const db = drizzle(pglite, { schema }) as unknown as Database;
  await migrate(drizzle(pglite, { schema }), { migrationsFolder });
  return { db, close: () => pglite.close() };
}

export async function createTestUser(db: Database, id: string) {
  await db
    .insert(schema.user)
    .values({ id, name: `User ${id}`, email: `${id}@example.test` });
  return id;
}

export function recordingJobs() {
  const enqueued: string[] = [];
  const jobs: JobProducer = {
    enqueueMaterialize: ({ workSessionId }) => {
      enqueued.push(workSessionId);
      return Promise.resolve(workSessionId);
    },
  };
  return { jobs, enqueued };
}

type SessionUser = AppBindings["Variables"]["user"];

function sessionFor(userId: string) {
  const now = new Date();
  return {
    session: {
      id: `session-${userId}`,
      token: `token-${userId}`,
      userId,
      expiresAt: new Date(Date.now() + 3_600_000),
      createdAt: now,
      updatedAt: now,
    },
    user: {
      id: userId,
      name: `User ${userId}`,
      email: `${userId}@example.test`,
      emailVerified: false,
      image: null,
      createdAt: now,
      updatedAt: now,
    } as SessionUser,
  };
}

/**
 * Full application wired to a real (in-process) database. Authentication is
 * the only stub: requests authenticate as the user named in the
 * `x-test-user` header; requests without it are anonymous.
 */
export function createTestApp(
  db: Database,
  overrides: Partial<RuntimeDependencies> = {},
) {
  const { jobs, enqueued } = recordingJobs();
  const reported: unknown[] = [];
  const dependencies: RuntimeDependencies = {
    db,
    auth: {
      api: {
        getSession: ({ headers }: { headers: Headers }) => {
          const userId = headers.get("x-test-user");
          return Promise.resolve(userId ? sessionFor(userId) : null);
        },
      },
      handler: () => Promise.resolve(new Response("auth-handler")),
    } as unknown as RuntimeDependencies["auth"],
    cipher: testCipher,
    jobs,
    projectBuilder: recordingProjectBuilder().projectBuilder,
    // Real: reading files is the filesystem, and a stub of it would test
    // nothing. Tests that browse a project point a session at a temp directory.
    projectFiles: createLocalProjectFiles(),
    log: silentLogger,
    reportError: (error) => {
      reported.push(error);
    },
    ready: () => Promise.resolve(),
    ...overrides,
  };
  return { app: createApp(dependencies), enqueued, reported };
}

export function asUser(userId: string, init: RequestInit = {}): RequestInit {
  return {
    ...init,
    headers: { "x-test-user": userId, ...(init.headers ?? {}) },
  };
}

export function jsonBody(value: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(value),
  };
}
