import { resolve } from "node:path";

import type { Database } from "../../src/db/client.js";

import type { BackofficeDependencies } from "./dependencies.js";
import { upsertEnvFileValues } from "./env-file.js";
import { loadBackofficeEnvironment } from "./env.js";

/** Production/dev wiring: environment from process.env, persistence to .env. */
export function createBackofficeDependencies(
  db: Database,
): BackofficeDependencies {
  return {
    db,
    environment: loadBackofficeEnvironment(),
    persistEnvironment: (values) =>
      upsertEnvFileValues(resolve(process.cwd(), ".env"), values),
  };
}
