import { toApiError } from "./errors.js";
import type { ClientEvent } from "./events.js";
import type { ClientStore } from "./projection.js";

type PendingResponse = Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

/**
 * The one shape of every API-backed action: await the response, throw
 * `ApiError` on failure, dispatch the resulting fact. The body goes through
 * `unknown` for the same reason as `readJson` in api.ts — comparing hc's
 * recursive inferred types structurally sends tsc past its depth limit.
 */
export async function commit<Body>(
  store: ClientStore,
  request: PendingResponse,
  toEvent: (body: Body) => ClientEvent,
): Promise<Body> {
  const response = await request;
  if (!response.ok) throw await toApiError(response);
  const body = (await response.json()) as Body;
  store.dispatch(toEvent(body));
  return body;
}

/**
 * `commit` for endpoints whose success answer carries no body (deletes):
 * the event is a value, and the response is never parsed.
 */
export async function commitEmpty(
  store: ClientStore,
  request: PendingResponse,
  event: ClientEvent,
): Promise<void> {
  const response = await request;
  if (!response.ok) throw await toApiError(response);
  store.dispatch(event);
}
