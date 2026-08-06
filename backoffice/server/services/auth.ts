import { AppError } from "../../../src/errors.js";
import type { BackofficeDependencies } from "../dependencies.js";
import type { BackofficeEnvironment } from "../env.js";
import { hashPassword, verifyPassword } from "../password.js";

type BackofficeCredentials = { email: string; password: string };

export function isBackofficeConfigured(
  environment: BackofficeEnvironment,
): boolean {
  return Boolean(
    environment.BACKOFFICE_ADMIN_EMAIL &&
    environment.BACKOFFICE_ADMIN_PASSWORD_HASH,
  );
}

export async function setupBackofficeAdmin(
  dependencies: BackofficeDependencies,
  credentials: BackofficeCredentials,
): Promise<void> {
  const { environment } = dependencies;
  if (isBackofficeConfigured(environment))
    throw new AppError(
      "CONFLICT",
      "The backoffice admin is already configured",
      409,
    );
  const passwordHash = await hashPassword(credentials.password);
  await dependencies.persistEnvironment({
    BACKOFFICE_ADMIN_EMAIL: credentials.email,
    BACKOFFICE_ADMIN_PASSWORD_HASH: passwordHash,
  });
  // The running process picks the credential up without a restart.
  environment.BACKOFFICE_ADMIN_EMAIL = credentials.email;
  environment.BACKOFFICE_ADMIN_PASSWORD_HASH = passwordHash;
}

export async function verifyBackofficeCredentials(
  environment: BackofficeEnvironment,
  credentials: BackofficeCredentials,
): Promise<void> {
  const email = environment.BACKOFFICE_ADMIN_EMAIL;
  const passwordHash = environment.BACKOFFICE_ADMIN_PASSWORD_HASH;
  const matches =
    email !== undefined &&
    passwordHash !== undefined &&
    credentials.email === email &&
    (await verifyPassword(credentials.password, passwordHash));
  if (!matches)
    throw new AppError(
      "AUTHENTICATION_REQUIRED",
      "Invalid email or password",
      401,
    );
}
