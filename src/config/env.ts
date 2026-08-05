import "dotenv/config";

import { z } from "zod";

const environmentSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().positive().max(65_535).default(3000),
    DATABASE_URL: z.string().url().startsWith("postgres"),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.string().url().optional(),
    RENDER_EXTERNAL_URL: z.string().url().optional(),
    TRUSTED_ORIGINS: z.string().optional(),
    SECRETS_ENCRYPTION_KEY: z
      .string()
      .refine(
        (value) => Buffer.from(value, "base64").length === 32,
        "must be a base64-encoded 32-byte key",
      ),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    SENTRY_DSN: z.union([z.string().url(), z.literal("")]).optional(),
    SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  })
  .refine(
    (value) =>
      value.BETTER_AUTH_URL !== undefined ||
      value.RENDER_EXTERNAL_URL !== undefined,
    {
      message: "BETTER_AUTH_URL or RENDER_EXTERNAL_URL is required",
      path: ["BETTER_AUTH_URL"],
    },
  )
  .transform((value) => {
    const baseUrl = value.BETTER_AUTH_URL ?? value.RENDER_EXTERNAL_URL;
    if (!baseUrl) throw new Error("An authentication base URL is required");
    return {
      ...value,
      BETTER_AUTH_URL: baseUrl,
      TRUSTED_ORIGINS: (value.TRUSTED_ORIGINS ?? baseUrl)
        .split(",")
        .map((origin) => origin.trim()),
    };
  });

export type Environment = z.infer<typeof environmentSchema>;

export function loadEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): Environment {
  const result = environmentSchema.safeParse(source);
  if (!result.success) {
    const fields = result.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");
    throw new Error(`Invalid environment configuration: ${fields}`);
  }
  return result.data;
}
