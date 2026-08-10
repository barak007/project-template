import { createRoot } from "react-dom/client";

import { createAppCore } from "../client/index.js";
import type { History } from "../client/index.js";

import { App } from "./app.js";
import "./styles.css";

const browserHistory: History = {
  path: () => window.location.pathname,
  push: (path) => {
    window.history.pushState(null, "", path);
    window.scrollTo(0, 0);
  },
  replace: (path) => {
    window.history.replaceState(null, "", path);
  },
  onChange: (listener) => {
    window.addEventListener("popstate", () => {
      listener(window.location.pathname);
    });
  },
};

// The API is served from this same origin (see app/server/web.ts), so the
// session cookie needs no cross-origin handling.
export const core = createAppCore({
  baseUrl: "",
  host: { fetch: (input, init) => window.fetch(input, init) },
  history: browserHistory,
});

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");
createRoot(root).render(<App core={core} />);
