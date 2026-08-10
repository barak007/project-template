import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import { createWebApp } from "../server/web.js";

const shell = "<!doctype html><title>Acme</title>";

/** An API that answers like the real one: JSON, with its 404 envelope. */
const api = {
  fetch: (request: Request) =>
    new URL(request.url).pathname === "/api/organizations"
      ? Response.json([{ id: "org-1" }], { status: 200 })
      : Response.json(
          { error: { code: "NOT_FOUND", message: "Route not found" } },
          { status: 404 },
        ),
};

describe("the web app shell", () => {
  let distDir: string;

  beforeAll(async () => {
    distDir = await mkdtemp(join(tmpdir(), "app-dist-"));
    await writeFile(join(distDir, "index.html"), shell, "utf8");
  });

  it("passes API responses through untouched", async () => {
    const response = await createWebApp(api, distDir).request(
      "/api/organizations",
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([{ id: "org-1" }]);
  });

  it("serves the app shell for a client route", async () => {
    const response = await createWebApp(api, distDir).request(
      "/app/organizations/org-1",
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(shell);
  });

  it("keeps the API's 404 envelope for unknown API paths", async () => {
    const web = createWebApp(api, distDir);
    for (const path of ["/api/nope", "/backoffice/nope", "/assets/gone.js"]) {
      const response = await web.request(path);
      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({
        error: { code: "NOT_FOUND" },
      });
    }
  });

  it("says so when the app has not been built", async () => {
    const response = await createWebApp(api, join(distDir, "missing")).request(
      "/",
    );
    expect(response.status).toBe(500);
    expect(await response.text()).toContain("pnpm build");
  });
});
