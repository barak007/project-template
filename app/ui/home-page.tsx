import type { AppCore } from "../client/index.js";

import { RouteLink } from "./route-link.js";
import { SiteHeader } from "./site-header.js";

/**
 * The public home page — the one page a visitor sees before signing up.
 * Replace the copy; the structure (hero, three claims, closing call) is what
 * a landing page needs.
 */
export function HomePage({ core }: { core: AppCore }) {
  return (
    <div className="site">
      <SiteHeader core={core} />
      <main>
        <section className="hero">
          <p className="eyebrow">Boilerplate, assembled</p>
          <h1>Ship the product, not the plumbing.</h1>
          <p className="lead">
            Authentication, organizations, a typed API, a headless client, an
            operator console and a deploy pipeline — already wired together and
            tested. Start with the feature you actually wanted to build.
          </p>
          <div className="hero-actions">
            <RouteLink core={core} to={{ kind: "sign-up" }} className="button">
              Create an account
            </RouteLink>
            <RouteLink core={core} to={{ kind: "sign-in" }} className="link">
              I already have one
            </RouteLink>
          </div>
        </section>
        <section className="claims">
          <article>
            <h2>Multi-tenant from the first commit</h2>
            <p>
              Users, organizations and memberships with the authorization rules
              enforced in the services — not bolted on later.
            </p>
          </article>
          <article>
            <h2>One typed contract</h2>
            <p>
              Routes, validation and client types come from the same source, so
              a server change that breaks a caller breaks the build.
            </p>
          </article>
          <article>
            <h2>Testable without a browser</h2>
            <p>
              Every flow on this page is client logic that runs in Node against
              the real server — rendering is never required to test it.
            </p>
          </article>
        </section>
        <section className="closing">
          <h2>Ready when you are.</h2>
          <RouteLink core={core} to={{ kind: "sign-up" }} className="button">
            Get started
          </RouteLink>
        </section>
      </main>
      <footer className="site-footer">
        <span>© Acme</span>
        <RouteLink core={core} to={{ kind: "sign-in" }} className="link">
          Sign in
        </RouteLink>
      </footer>
    </div>
  );
}
