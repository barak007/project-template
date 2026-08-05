import { hc } from "hono/client";
import type { InferResponseType } from "hono/client";

import type { AppType } from "../../src/app.js";

/**
 * The one injected boundary to the outside world. In a browser this is the
 * global fetch; in Node tests it is the in-process Hono app's request method.
 */
export type ClientFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

// Hono's documented pattern for compile performance: infer the client type
// once from a value-level hc call; ReturnType-based derivation makes tsc
// recompute the whole route tree and fails with "excessively deep".
const _apiTypeWitness = hc<AppType>("");
export type Api = typeof _apiTypeWitness;

export function createApi(baseUrl: string, fetch: ClientFetch): Api {
  return hc<AppType>(baseUrl, { fetch });
}

export type Organization = InferResponseType<
  Api["api"]["organizations"]["$get"]
>[number];
