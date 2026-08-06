import "dotenv/config";

import { eq } from "drizzle-orm";

import { loadEnvironment } from "../src/config/env.js";
import { createDatabase } from "../src/db/client.js";
import { platformAdmins, user } from "../src/db/schema.js";

const email = process.argv[2];
if (!email) {
  console.error("Usage: pnpm admin:grant <email>");
  process.exit(1);
}

const environment = loadEnvironment();
const { db, client } = createDatabase(environment);
try {
  const [target] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);
  if (!target) {
    console.error(`No user with email ${email} — sign up first, then grant.`);
    process.exit(1);
  }
  await db
    .insert(platformAdmins)
    .values({ userId: target.id })
    .onConflictDoNothing();
  console.info(`${email} is a platform admin`);
} finally {
  await client.end();
}
