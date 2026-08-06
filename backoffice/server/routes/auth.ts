import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { validationHook } from "../../../src/http/validation.js";
import type { BackofficeDependencies } from "../dependencies.js";
import {
  backofficeAuthStatusResponseSchema,
  backofficeSessionResponseSchema,
  backofficeSetupInputSchema,
  backofficeSignInInputSchema,
} from "../entities/auth.js";
import {
  isBackofficeConfigured,
  setupBackofficeAdmin,
  verifyBackofficeCredentials,
} from "../services/auth.js";
import {
  clearBackofficeSession,
  hasBackofficeSession,
  issueBackofficeSession,
} from "../session.js";

export function createBackofficeAuthRoutes(
  dependencies: BackofficeDependencies,
) {
  const { environment } = dependencies;
  return new Hono()
    .get("/status", async (context) => {
      const configured = isBackofficeConfigured(environment);
      const authenticated =
        configured && (await hasBackofficeSession(context, environment));
      return context.json(
        backofficeAuthStatusResponseSchema.parse({
          configured,
          authenticated,
          ...(authenticated
            ? { email: environment.BACKOFFICE_ADMIN_EMAIL }
            : {}),
        }),
        200,
      );
    })
    .post(
      "/setup",
      zValidator("json", backofficeSetupInputSchema, validationHook),
      async (context) => {
        const credentials = context.req.valid("json");
        await setupBackofficeAdmin(dependencies, credentials);
        await issueBackofficeSession(context, environment);
        return context.json(
          backofficeSessionResponseSchema.parse({ email: credentials.email }),
          201,
        );
      },
    )
    .post(
      "/sign-in",
      zValidator("json", backofficeSignInInputSchema, validationHook),
      async (context) => {
        const credentials = context.req.valid("json");
        await verifyBackofficeCredentials(environment, credentials);
        await issueBackofficeSession(context, environment);
        return context.json(
          backofficeSessionResponseSchema.parse({ email: credentials.email }),
          200,
        );
      },
    )
    .post("/sign-out", (context) => {
      clearBackofficeSession(context);
      return context.json({ signedOut: true as const }, 200);
    });
}
