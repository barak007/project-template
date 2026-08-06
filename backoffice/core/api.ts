import { hc } from "hono/client";
import type { InferResponseType } from "hono/client";

import type { Host } from "../../client/src/host.js";
import type { BackofficeRoutes } from "../server/index.js";

// Hono's documented pattern for compile performance: infer the client type
// once from a value-level hc call; ReturnType-based derivation makes tsc
// recompute the whole route tree and fails with "excessively deep".
const _apiTypeWitness = hc<BackofficeRoutes>("");
export type Api = typeof _apiTypeWitness;

/** The backoffice API is mounted under /backoffice by the server entry. */
export function createApi(baseUrl: string, host: Host): Api {
  return hc<BackofficeRoutes>(`${baseUrl}/backoffice`, {
    fetch: host.fetch,
  });
}

// Admin responses are deliberately flat (no jsonb payloads), so plain
// InferResponseType works — none of client/src/api.ts's re-typing is needed.
type AdminRoutes = Api["admin"];

export type AdminUser = InferResponseType<AdminRoutes["users"]["$get"]>[number];
export type AdminOrganization = InferResponseType<
  AdminRoutes["organizations"]["$get"]
>[number];
export type OrganizationDetail = InferResponseType<
  AdminRoutes["organizations"][":organizationId"]["$get"]
>;
