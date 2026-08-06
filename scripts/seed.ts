import "dotenv/config";

import { loadEnvironment } from "../domain-server/config/env.js";
import { createDatabase } from "../domain-server/db/client.js";
import {
  organizationMembers,
  organizations,
  user,
} from "../domain-server/db/schema.js";

const SEED_USER_ID = "seed-user";
const SEED_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000001";
const environment = loadEnvironment();
const { db, client } = createDatabase(environment);
try {
  await db.transaction(async (transaction) => {
    await transaction
      .insert(user)
      .values({
        id: SEED_USER_ID,
        name: "Seed User",
        email: "seed@example.test",
      })
      .onConflictDoNothing();
    await transaction
      .insert(organizations)
      .values({ id: SEED_ORGANIZATION_ID, name: "Example Organization" })
      .onConflictDoUpdate({
        target: organizations.id,
        set: { name: "Example Organization", updatedAt: new Date(0) },
      });
    await transaction
      .insert(organizationMembers)
      .values({
        organizationId: SEED_ORGANIZATION_ID,
        userId: SEED_USER_ID,
        role: "owner",
      })
      .onConflictDoUpdate({
        target: [
          organizationMembers.organizationId,
          organizationMembers.userId,
        ],
        set: { role: "owner" },
      });
  });
  console.info("Deterministic seed data loaded");
} finally {
  await client.end();
}
