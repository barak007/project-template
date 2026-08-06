import { hc } from "hono/client";
import type { InferRequestType, InferResponseType } from "hono/client";

import type { AppType } from "../domain-server/app.js";

import type { Host } from "./host.js";

// Hono's documented pattern for compile performance: infer the client type
// once from a value-level hc call; ReturnType-based derivation makes tsc
// recompute the whole route tree and fails with "excessively deep".
const _apiTypeWitness = hc<AppType>("");
export type Api = typeof _apiTypeWitness;

export function createApi(baseUrl: string, host: Host): Api {
  return hc<AppType>(baseUrl, { fetch: host.fetch });
}

type OrganizationRoutes = Api["api"]["organizations"][":organizationId"];

/**
 * Reads a response body as one of the re-typed entities below. Assigning
 * hc's inferred body straight to them makes tsc compare two recursive JSON
 * types and hit its depth limit, so the boundary goes through unknown.
 */
export async function readJson<T>(response: {
  json: () => Promise<unknown>;
}): Promise<T> {
  return (await response.json()) as T;
}

export type Organization = InferResponseType<
  Api["api"]["organizations"]["$get"]
>[number];
export type OrganizationInput = InferRequestType<
  Api["api"]["organizations"]["$post"]
>["json"];
export type Membership = InferResponseType<
  OrganizationRoutes["members"]["$get"]
>[number];
export type MembershipInput = InferRequestType<
  OrganizationRoutes["members"]["$put"]
>["json"];
/**
 * JSON payload fields (source config, data values, snapshots) are re-typed
 * with this plain recursion: hc infers them through a mapped recursive type
 * that makes tsc hit its instantiation-depth limit as soon as they are
 * mapped or filtered over.
 */
export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type Source = Omit<
  InferResponseType<OrganizationRoutes["sources"]["$get"]>[number],
  "config"
> & { config: JsonValue };
export type SourceInput = InferRequestType<
  OrganizationRoutes["sources"]["$post"]
>["json"];
export type Workspace = InferResponseType<
  OrganizationRoutes["workspaces"]["$get"]
>[number];
export type WorkspaceInput = InferRequestType<
  OrganizationRoutes["workspaces"]["$post"]
>["json"];
export type WorkSession = Omit<
  InferResponseType<OrganizationRoutes["work-sessions"]["$get"]>[number],
  "sourcesSnapshot" | "dataSnapshot"
> & {
  sourcesSnapshot: {
    id: string;
    name: string;
    kind: "git" | "database" | "other";
    config: JsonValue;
  }[];
  dataSnapshot: Record<string, JsonValue>;
};
export type Secret = InferResponseType<
  OrganizationRoutes["secrets"]["$get"]
>[number];
export type SecretInput = InferRequestType<
  OrganizationRoutes["secrets"]["$put"]
>["json"];
export type DataEntry = Omit<
  InferResponseType<OrganizationRoutes["data"]["$get"]>[number],
  "value"
> & { value: JsonValue };
export type DataInput = InferRequestType<
  OrganizationRoutes["data"]["$put"]
>["json"];
