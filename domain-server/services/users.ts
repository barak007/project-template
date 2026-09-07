import { eq } from "drizzle-orm";

import type { Database } from "../db/client.js";
import { user } from "../db/schema.js";

/**
 * Attaches the user's name and email to a row that references them — responses
 * name people because nobody can be asked to recognise a user id. Absent users
 * come back as empty strings rather than an error: the row itself is real.
 */
export async function withUserName<Row extends { userId: string }>(
  db: Database,
  row: Row,
) {
  const [person] = await db
    .select({ name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, row.userId))
    .limit(1);
  return {
    ...row,
    name: person?.name ?? "",
    email: person?.email ?? "",
  };
}
