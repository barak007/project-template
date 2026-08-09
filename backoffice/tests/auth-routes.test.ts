import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "../../domain-server/db/client.js";
import {
  createTestDatabase,
  jsonBody,
} from "../../domain-server/tests/helpers/harness.js";
import { verifyPassword } from "../server/password.js";

import {
  backofficeAdminCredentials,
  backofficeSessionCookie,
  backofficeTestEnvironment,
  createBackofficeTestApp,
  withCookie,
} from "./harness.js";

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
});

afterAll(async () => {
  await close();
});

async function json(response: Response): Promise<unknown> {
  return response.json();
}

const unconfigured = () =>
  backofficeTestEnvironment({
    BACKOFFICE_ADMIN_EMAIL: "",
    BACKOFFICE_ADMIN_PASSWORD_HASH: "",
  });

describe("backoffice first-run setup", () => {
  it("walks from unconfigured to an authenticated admin", async () => {
    const { app, persisted } = createBackofficeTestApp(db, {
      environment: unconfigured(),
    });

    const status = await app.request("/backoffice/auth/status");
    expect(await json(status)).toEqual({
      configured: false,
      authenticated: false,
    });
    expect((await app.request("/backoffice/data/tables")).status).toBe(401);

    const setup = await app.request(
      "/backoffice/auth/setup",
      jsonBody({ email: "operator@example.test", password: "first-password" }),
    );
    expect(setup.status).toBe(201);
    expect(await json(setup)).toEqual({ email: "operator@example.test" });

    // The credential is persisted with a hash, never the raw password.
    expect(persisted).toHaveLength(1);
    const saved = persisted[0] ?? {};
    expect(saved.BACKOFFICE_ADMIN_EMAIL).toBe("operator@example.test");
    expect(saved.BACKOFFICE_ADMIN_PASSWORD_HASH).not.toContain(
      "first-password",
    );
    expect(
      await verifyPassword(
        "first-password",
        saved.BACKOFFICE_ADMIN_PASSWORD_HASH ?? "",
      ),
    ).toBe(true);

    // The setup response signs the browser in immediately.
    const cookie = setup.headers.get("set-cookie")?.split(";")[0];
    expect(cookie).toBeTruthy();
    const after = await app.request(
      "/backoffice/auth/status",
      withCookie(cookie ?? ""),
    );
    expect(await json(after)).toEqual({
      configured: true,
      authenticated: true,
      email: "operator@example.test",
    });
    expect(
      (await app.request("/backoffice/data/tables", withCookie(cookie ?? "")))
        .status,
    ).toBe(200);
  });

  it("rejects setup once configured", async () => {
    const { app } = createBackofficeTestApp(db);
    const response = await app.request(
      "/backoffice/auth/setup",
      jsonBody({ email: "second@example.test", password: "irrelevant-pw" }),
    );
    expect(response.status).toBe(409);
    expect(await json(response)).toMatchObject({ error: { code: "CONFLICT" } });
  });

  it("rejects a too-short setup password", async () => {
    const { app, persisted } = createBackofficeTestApp(db, {
      environment: unconfigured(),
    });
    const response = await app.request(
      "/backoffice/auth/setup",
      jsonBody({ email: "operator@example.test", password: "short" }),
    );
    expect(response.status).toBe(400);
    expect(persisted).toHaveLength(0);
  });
});

describe("backoffice sign-in", () => {
  it("accepts the configured credential and grants the admin API", async () => {
    const { app } = createBackofficeTestApp(db);
    const cookie = await backofficeSessionCookie(app);
    const response = await app.request(
      "/backoffice/data/tables",
      withCookie(cookie),
    );
    expect(response.status).toBe(200);
  });

  it("rejects a wrong password without leaking which field failed", async () => {
    const { app } = createBackofficeTestApp(db);
    const response = await app.request(
      "/backoffice/auth/sign-in",
      jsonBody({
        email: backofficeAdminCredentials.email,
        password: "wrong-password",
      }),
    );
    expect(response.status).toBe(401);
    expect(await json(response)).toMatchObject({
      error: { message: "Invalid email or password" },
    });
  });

  it("rejects sign-in while unconfigured", async () => {
    const { app } = createBackofficeTestApp(db, {
      environment: unconfigured(),
    });
    const response = await app.request(
      "/backoffice/auth/sign-in",
      jsonBody(backofficeAdminCredentials),
    );
    expect(response.status).toBe(401);
  });

  it("rejects a tampered session cookie", async () => {
    const { app } = createBackofficeTestApp(db);
    const cookie = await backofficeSessionCookie(app);
    const forged = cookie.replace(/.$/, (last) => (last === "a" ? "b" : "a"));
    const response = await app.request(
      "/backoffice/data/tables",
      withCookie(forged),
    );
    expect(response.status).toBe(401);
  });

  it("sign-out expires the cookie", async () => {
    const { app } = createBackofficeTestApp(db);
    const response = await app.request("/backoffice/auth/sign-out", {
      method: "POST",
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain(
      "backoffice_session=;",
    );
  });
});
