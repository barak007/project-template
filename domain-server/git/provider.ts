import type { JsonValue } from "../db/schema.js";
import type { ConnectionProviderName } from "../entities/connection.js";

/**
 * One repository a connection exposes. `externalId` identifies it inside the
 * provider (a directory name locally, a repository id on GitHub) and `remote`
 * is whatever `git clone` accepts.
 */
export type RemoteRepository = {
  externalId: string;
  name: string;
  remote: string;
};

/** What connecting produced: how to show the connection, and how to use it. */
export type ConnectedAccount = { label: string; config: JsonValue };

/**
 * Everything the domain needs from a git host, so that neither the services
 * nor the routes know whether repositories come from a GitHub App or from a
 * directory on this machine. Implementations own the shape of their own
 * `config` and validate it in `connect`.
 */
export type GitProvider = {
  connect: (config: JsonValue) => Promise<ConnectedAccount>;
  listRepositories: (config: JsonValue) => Promise<RemoteRepository[]>;
};

/**
 * The providers this deployment can actually use. A provider missing from the
 * registry is a provider the domain refuses to connect — which is how
 * `github` behaves until its credentials exist.
 */
export type GitProviders = Partial<Record<ConnectionProviderName, GitProvider>>;
