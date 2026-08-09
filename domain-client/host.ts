/**
 * A fetch the host provides. In a browser this wraps the global fetch; in
 * Node tests it is bound to the test world's server.
 */
export type ClientFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

/**
 * The host abstracts every capability the client core needs from its
 * environment. The core never touches platform globals — no DOM, no Node
 * builtins, not even global fetch (ESLint enforces all three); anything
 * environmental enters through this boundary, so the same core runs in a
 * browser, in Node, or anywhere a host can be written for.
 */
export type Host = {
  fetch: ClientFetch;
};
