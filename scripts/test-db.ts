import "dotenv/config";

import { migrate } from "drizzle-orm/postgres-js/migrator";

import { loadEnvironment } from "../domain-server/config/env.js";
import { createDatabase } from "../domain-server/db/client.js";

const environment = loadEnvironment();
const databaseName = new URL(environment.DATABASE_URL).pathname.slice(1);
if (!databaseName.includes("test"))
  throw new Error(
    "Refusing to prepare a database whose name does not contain 'test'",
  );
const { db, client } = createDatabase(environment);
try {
  await migrate(db, { migrationsFolder: "drizzle" });
  console.info(`Test database ${databaseName} is ready`);
} finally {
  await client.end();
}
