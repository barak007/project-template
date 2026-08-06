import "dotenv/config";

import { z } from "zod";

/**
 * Backoffice-owned environment schema — the app's schema (src/config/env.ts)
 * knows nothing about the backoffice. Defaults live here, once.
 */
const backofficeEnvironmentSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    BACKOFFICE_PORT: z.coerce
      .number()
      .int()
      .positive()
      .max(65_535)
      .default(5173),
    // Backoffice sessions are signed with the same server secret the app uses.
    BETTER_AUTH_SECRET: z.string().min(32),
    // The backoffice admin credential — deliberately not an application user.
    // Both empty means "not configured yet"; the backoffice then offers the
    // first-run setup screen, which writes these back to .env.
    BACKOFFICE_ADMIN_EMAIL: z.union([z.email(), z.literal("")]).optional(),
    BACKOFFICE_ADMIN_PASSWORD_HASH: z.string().optional(),
  })
  .transform((value) => ({
    ...value,
    // `KEY=` lines in .env arrive as empty strings; both mean unset.
    BACKOFFICE_ADMIN_EMAIL:
      value.BACKOFFICE_ADMIN_EMAIL === ""
        ? undefined
        : value.BACKOFFICE_ADMIN_EMAIL,
    BACKOFFICE_ADMIN_PASSWORD_HASH:
      value.BACKOFFICE_ADMIN_PASSWORD_HASH === ""
        ? undefined
        : value.BACKOFFICE_ADMIN_PASSWORD_HASH,
  }));

export type BackofficeEnvironment = z.infer<typeof backofficeEnvironmentSchema>;

export function loadBackofficeEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): BackofficeEnvironment {
  const result = backofficeEnvironmentSchema.safeParse(source);
  if (!result.success) {
    const fields = result.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");
    throw new Error(`Invalid backoffice environment configuration: ${fields}`);
  }
  return result.data;
}
