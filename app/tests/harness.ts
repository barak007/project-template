import { browserFetch } from "../../domain-client/tests/kit/browser-fetch.js";
import type { World } from "../../domain-client/tests/kit/world.js";
import { createAppCore, createMemoryHistory } from "../client/index.js";
import type { AppCore, MemoryHistory } from "../client/index.js";

export type Visitor = {
  core: AppCore;
  history: MemoryHistory;
  /** The fresh core a page load builds — same browser, same cookie jar. */
  reload: () => AppCore;
};

/**
 * One browser opening the app at `path`: its own cookie jar and its own
 * history, so a story can start on any URL — including one behind the login.
 */
export function visit(world: World, path = "/"): Visitor {
  const history = createMemoryHistory(path);
  const fetch = browserFetch(world.request);
  const open = () =>
    createAppCore({ baseUrl: world.baseUrl, host: { fetch }, history });
  return { core: open(), history, reload: open };
}

/** Fills the sign-up form and submits it, the way the page does. */
export async function signUp(
  core: AppCore,
  credentials: { name: string; email: string; password: string },
) {
  core.session.changeSignUpDraft(credentials);
  await core.session.signUp();
}

/** Fills the sign-in form and submits it, the way the page does. */
export async function signIn(
  core: AppCore,
  credentials: { email: string; password: string },
) {
  core.session.changeSignInDraft(credentials);
  await core.session.signIn();
}
