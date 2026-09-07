import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import type { z } from "zod";

import { AppError } from "../errors.js";

type ValidationResult<T> =
  | { success: true; data: T; target: string }
  | {
      success: false;
      data: T;
      error: { issues: readonly unknown[] };
      target: string;
    };

export function validationHook<T>(result: ValidationResult<T>): void {
  if (!result.success) {
    throw new AppError("VALIDATION_FAILED", "Request validation failed", 400, {
      issues: result.error.issues,
    });
  }
}

/** `zValidator` with the one hook every route wants: failures become AppError. */
export function validate<
  Target extends keyof ValidationTargets,
  Schema extends z.ZodType,
>(target: Target, schema: Schema) {
  return zValidator(target, schema, validationHook);
}
