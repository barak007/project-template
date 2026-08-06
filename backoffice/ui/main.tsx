import { createRoot } from "react-dom/client";

import { createBackofficeCore } from "../core/index.js";

import { App } from "./app.js";
import "./styles.css";

export const core = createBackofficeCore({
  baseUrl: "",
  host: { fetch: (input, init) => window.fetch(input, init) },
});

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");
createRoot(root).render(<App core={core} />);
