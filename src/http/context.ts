import type { Auth, AuthSession } from "../auth.js";
import type { SecretCipher } from "../crypto/secrets.js";
import type { Database } from "../db/client.js";
import type { JobProducer } from "../jobs/queue.js";
import type { ErrorReporter } from "../observability.js";

export type RuntimeDependencies = {
  db: Database;
  auth: Auth;
  cipher: SecretCipher;
  jobs: JobProducer;
  reportError: ErrorReporter;
  ready: () => Promise<void>;
};

export type AppBindings = {
  Variables: {
    session: NonNullable<AuthSession>["session"];
    user: NonNullable<AuthSession>["user"];
  };
};
