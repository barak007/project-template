import type { Context } from "hono";
import { z } from "zod";

export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export type ErrorCode =
  | "AUTHENTICATION_REQUIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_FAILED"
  | "CONFLICT"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status: 400 | 401 | 403 | 404 | 409 | 500,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export function handleError(error: Error, context: Context) {
  if (error instanceof AppError) {
    const body = errorResponseSchema.parse({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
    });
    return context.json(body, error.status);
  }
  if ("code" in error && error.code === "23505") {
    return context.json(
      errorResponseSchema.parse({
        error: {
          code: "CONFLICT",
          message: "A record with these values already exists",
        },
      }),
      409,
    );
  }
  if ("code" in error && error.code === "23503") {
    return context.json(
      errorResponseSchema.parse({
        error: { code: "CONFLICT", message: "The record is still in use" },
      }),
      409,
    );
  }
  console.error("Unhandled request error", error);
  return context.json(
    errorResponseSchema.parse({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      },
    }),
    500,
  );
}
