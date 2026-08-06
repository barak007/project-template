import { createRoot } from "react-dom/client";

import { createBackofficeCore } from "../client/index.js";
import type { History } from "../client/index.js";

import { App } from "./app.js";
import "./styles.css";

const browserHistory: History = {
  path: () => window.location.pathname,
  push: (path) => {
    window.history.pushState(null, "", path);
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

export const core = createBackofficeCore({
  baseUrl: "",
  host: { fetch: (input, init) => window.fetch(input, init) },
  history: browserHistory,
});
void core.auth.loadStatus();

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");
createRoot(root).render(<App core={core} />);
