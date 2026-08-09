import { hc } from "hono/client";
import type { InferResponseType } from "hono/client";

import type { Host } from "../../client/host.js";
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
// InferResponseType works — none of client/api.ts's re-typing is needed.
type AdminRoutes = Api["admin"];

export type OrganizationDetail = InferResponseType<
  AdminRoutes["organizations"][":organizationId"]["$get"]
>;
export type UserDetail = InferResponseType<
  AdminRoutes["users"][":userId"]["$get"]
>;

// Data responses carry recursive JSON values, which InferResponseType cannot
// walk without blowing the instantiation depth — so their types come from the
// server's zod schemas directly (type-only, same as BackofficeRoutes above).
export type {
  ColumnMeta,
  RowsPage,
  TableMeta,
  TableRow,
} from "../server/entities/data.js";
