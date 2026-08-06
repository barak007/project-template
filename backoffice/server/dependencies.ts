import type { Database } from "../../src/db/client.js";

import type { BackofficeEnvironment } from "./env.js";

export type BackofficeDependencies = {
  db: Database;
  environment: BackofficeEnvironment;
  /** Durably stores environment values (the first-run setup writes .env). */
  persistEnvironment: (values: Record<string, string>) => Promise<void>;
};
