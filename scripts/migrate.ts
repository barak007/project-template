import "dotenv/config";

import { migrate } from "drizzle-orm/postgres-js/migrator";

import { loadEnvironment } from "../domain-server/config/env.js";
import { createDatabase } from "../domain-server/db/client.js";

const environment = loadEnvironment();
const { db, client } = createDatabase(environment);
try {
  await migrate(db, { migrationsFolder: "drizzle" });
  console.info("Database migrations applied");
} finally {
  await client.end();
}
