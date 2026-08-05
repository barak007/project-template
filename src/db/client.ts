import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import type { Environment } from "../config/env.js";

import * as schema from "./schema.js";

export function createDatabase(environment: Environment) {
  const client = postgres(environment.DATABASE_URL, {
    max: 10,
    prepare: false,
  });
  return { client, db: drizzle(client, { schema }) };
}

export type Database = ReturnType<typeof createDatabase>["db"];
