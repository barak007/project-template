import { sql } from "drizzle-orm";

import { createAuth } from "./auth.js";
import { loadEnvironment } from "./config/env.js";
import { SecretCipher } from "./crypto/secrets.js";
import { createDatabase } from "./db/client.js";
import { createLocalGitProvider } from "./git/local-provider.js";
import { QueueRuntime } from "./jobs/queue.js";
import { configureObservability } from "./observability.js";

export async function createRuntime() {
  const environment = loadEnvironment();
  const { db, client } = createDatabase(environment);
  const queue = new QueueRuntime(environment.DATABASE_URL);
  const reportError = configureObservability(environment);
  await queue.start();
  return {
    environment,
    client,
    queue,
    dependencies: {
      db,
      auth: createAuth(db, environment),
      cipher: new SecretCipher(environment.SECRETS_ENCRYPTION_KEY),
      jobs: queue,
      // `github` joins the registry once its credentials exist; until then
      // connecting to it is a rejected request, not a missing feature.
      gitProviders: { local: createLocalGitProvider() },
      reportError,
      ready: async () => {
        await db.execute(sql`select 1`);
      },
    },
  };
}
