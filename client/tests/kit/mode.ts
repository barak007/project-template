/**
 * By default client stories run over real HTTP against one server shared by
 * the whole suite (started in global-setup; isolation comes from every test
 * using fresh identities). Set CLIENT_WORLD=in-process to give each test its
 * own in-process world instead — no network, a private database per test.
 */
export function clientWorldMode(): "http" | "in-process" {
  return process.env.CLIENT_WORLD === "in-process" ? "in-process" : "http";
}

/** How global-setup hands the shared server's address to the test workers. */
export const sharedBaseUrlVariable = "CLIENT_WORLD_URL";
