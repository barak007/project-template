import type { AppCore } from "../client/index.js";

import { RouteLink } from "./route-link.js";

/** The public site's header: brand plus the two ways in. */
export function SiteHeader({ core }: { core: AppCore }) {
  return (
    <header className="site-header">
      <RouteLink core={core} to={{ kind: "home" }} className="brand">
        Acme
      </RouteLink>
      <nav>
        <RouteLink core={core} to={{ kind: "sign-in" }} className="link">
          Sign in
        </RouteLink>
        <RouteLink core={core} to={{ kind: "sign-up" }} className="button">
          Get started
        </RouteLink>
      </nav>
    </header>
  );
}
