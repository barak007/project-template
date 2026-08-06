import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";

import type { Environment } from "./config/env.js";
import type { Database } from "./db/client.js";
import { schema } from "./db/schema.js";

export function createAuth(db: Database, environment: Environment) {
  return betterAuth({
    appName: "What We Sure About",
    baseURL: environment.BETTER_AUTH_URL,
    basePath: "/api/auth",
    secret: environment.BETTER_AUTH_SECRET,
    trustedOrigins: environment.TRUSTED_ORIGINS,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: { enabled: true },
    advanced: {
      defaultCookieAttributes: {
        httpOnly: true,
        secure: environment.NODE_ENV === "production",
        sameSite: "lax",
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type AuthSession = Awaited<ReturnType<Auth["api"]["getSession"]>>;
