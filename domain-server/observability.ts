import * as Sentry from "@sentry/node";

import type { Environment } from "./config/env.js";
import type { Logger } from "./logging.js";

export type ErrorReporter = (error: unknown) => void;

export function configureObservability(
  environment: Environment,
  log: Logger,
): ErrorReporter {
  if (environment.SENTRY_DSN) {
    Sentry.init({
      dsn: environment.SENTRY_DSN,
      environment: environment.NODE_ENV,
      sendDefaultPii: false,
      tracesSampleRate: environment.NODE_ENV === "production" ? 0.1 : 0,
    });
  }
  return (error) => {
    log.error("Application error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? (error.stack ?? null) : null,
    });
    if (environment.SENTRY_DSN) Sentry.captureException(error);
  };
}
