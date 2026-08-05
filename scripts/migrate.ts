import "dotenv/config";

import { migrate } from "drizzle-orm/postgres-js/migrator";

import { loadEnvironment } from "../src/config/env.js";
import { createDatabase } from "../src/db/client.js";

const environment = loadEnvironment();
const { db, client } = createDatabase(environment);
try {
  await migrate(db, { migrationsFolder: "drizzle" });
  console.info("Database migrations applied");
} finally {
  await client.end();
}
