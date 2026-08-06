import { hc } from "hono/client";
import type { InferResponseType } from "hono/client";

import type { Host } from "../../client/src/host.js";
import type { AppType } from "../../src/app.js";

// Hono's documented pattern for compile performance: infer the client type
// once from a value-level hc call; ReturnType-based derivation makes tsc
// recompute the whole route tree and fails with "excessively deep".
const _apiTypeWitness = hc<AppType>("");
export type Api = typeof _apiTypeWitness;

export function createApi(baseUrl: string, host: Host): Api {
  return hc<AppType>(baseUrl, { fetch: host.fetch });
}

// Admin responses are deliberately flat (no jsonb payloads), so plain
// InferResponseType works — none of client/src/api.ts's re-typing is needed.
type AdminRoutes = Api["api"]["admin"];

export type AdminUser = InferResponseType<AdminRoutes["users"]["$get"]>[number];
export type AdminOrganization = InferResponseType<
  AdminRoutes["organizations"]["$get"]
>[number];
export type OrganizationDetail = InferResponseType<
  AdminRoutes["organizations"][":organizationId"]["$get"]
>;
