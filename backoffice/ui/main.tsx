import { createRoot } from "react-dom/client";

import { createBackofficeCore } from "../client/index.js";
import type { History } from "../client/index.js";

import { App } from "./app.js";
import "./styles.css";

// Routes carry state in the query string (table filters), so the path
// surface is pathname + search.
const browserHistory: History = {
  path: () => window.location.pathname + window.location.search,
  push: (path) => {
    window.history.pushState(null, "", path);
  },
  replace: (path) => {
    window.history.replaceState(null, "", path);
  },
  onChange: (listener) => {
    window.addEventListener("popstate", () => {
      listener(window.location.pathname + window.location.search);
    });
  },
};

export const core = createBackofficeCore({
  baseUrl: "",
  host: { fetch: (input, init) => window.fetch(input, init) },
  history: browserHistory,
});
void core.auth.loadStatus();

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");
createRoot(root).render(<App core={core} />);
