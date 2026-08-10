import "dotenv/config";

import { z } from "zod";

/**
 * App-owned environment schema. In production the app is served by the API
 * process (web.ts) and needs no port of its own; this is the dev server's,
 * and like every default it lives in exactly one place.
 */
const appEnvironmentSchema = z.object({
  APP_PORT: z.coerce.number().int().positive().max(65_535).default(5174),
});

export type AppEnvironment = z.infer<typeof appEnvironmentSchema>;

export function loadAppEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): AppEnvironment {
  const result = appEnvironmentSchema.safeParse(source);
  if (!result.success) {
    const fields = result.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");
    throw new Error(`Invalid app environment configuration: ${fields}`);
  }
  return result.data;
}
