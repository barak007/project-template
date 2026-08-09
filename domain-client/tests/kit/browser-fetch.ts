import type { ClientFetch } from "../../index.js";

/**
 * Binds a fetch to an in-process app, persisting cookies like a browser so
 * the Better Auth session round-trips between requests. One jar per client —
 * two clients with separate jars behave like two devices.
 */
export function browserFetch(request: ClientFetch): ClientFetch {
  const jar = new Map<string, string>();
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    if (jar.size > 0) {
      headers.set(
        "cookie",
        [...jar].map(([name, value]) => `${name}=${value}`).join("; "),
      );
    }
    const response = await request(input, { ...init, headers });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(";");
      if (!pair) continue;
      const separator = pair.indexOf("=");
      const name = pair.slice(0, separator).trim();
      const value = pair.slice(separator + 1).trim();
      // An emptied value is how the server expires a cookie (sign-out).
      if (value) jar.set(name, value);
      else jar.delete(name);
    }
    return response;
  };
}
