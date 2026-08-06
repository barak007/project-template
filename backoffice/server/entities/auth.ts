import { z } from "zod";

// The backoffice admin is a standalone credential (stored in the server
// environment), deliberately not an application user.
export const backofficeSetupInputSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

// Sign-in accepts anything and lets verification fail with 401 — a too-short
// password is a wrong password, not a malformed request.
export const backofficeSignInInputSchema = z.object({
  email: z.string(),
  password: z.string(),
});

export const backofficeAuthStatusResponseSchema = z.object({
  configured: z.boolean(),
  authenticated: z.boolean(),
  email: z.string().optional(),
});

export const backofficeSessionResponseSchema = z.object({ email: z.string() });
