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
