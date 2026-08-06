import * as Sentry from "@sentry/node";

import type { Environment } from "./config/env.js";

export type ErrorReporter = (error: unknown) => void;

export function configureObservability(
  environment: Environment,
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
    console.error("Application error", error);
    if (environment.SENTRY_DSN) Sentry.captureException(error);
  };
}
