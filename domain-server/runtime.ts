import { sql } from "drizzle-orm";

import { createAuth } from "./auth.js";
import { loadEnvironment } from "./config/env.js";
import { SecretCipher } from "./crypto/secrets.js";
import { createDatabase } from "./db/client.js";
import { createLocalProjectBuilder } from "./git/local-project-builder.js";
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
      // Local because the server shares a machine with the person using it; a
      // bucket-backed builder replaces this one without anything above changing.
      projectBuilder: createLocalProjectBuilder(
        environment.WORK_SESSION_PROJECT_ROOT,
      ),
      reportError,
      ready: async () => {
        await db.execute(sql`select 1`);
      },
    },
  };
}
