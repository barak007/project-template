import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

import { AppError, handleError } from "../errors.js";
import { silentLogger } from "../logging.js";

function appThrowing(error: Error, log = silentLogger) {
  const app = new Hono();
  app.get("/", () => {
    throw error;
  });
  app.onError((thrown, context) => handleError(thrown, context, log));
  return app;
}

describe("handleError", () => {
  it("serializes AppError details", async () => {
    const response = await appThrowing(
      new AppError("VALIDATION_FAILED", "Bad input", 400, { issues: [] }),
    ).request("/");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "VALIDATION_FAILED",
        message: "Bad input",
        details: { issues: [] },
      },
    });
  });

  it("maps unique violations found on the error itself", async () => {
    const error = new Error("duplicate key");
    Object.assign(error, { code: "23505" });
    const response = await appThrowing(error).request("/");
    expect(response.status).toBe(409);
  });

  it("maps violations wrapped by the driver via the cause chain", async () => {
    const cause = Object.assign(new Error("fk"), { code: "23503" });
    const response = await appThrowing(
      new Error("Failed query", { cause }),
    ).request("/");
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: { code: "CONFLICT", message: "The record is still in use" },
    });
  });

  it("hides unknown errors behind a generic 500 and logs them", async () => {
    const errorLine = vi.fn();
    const response = await appThrowing(new Error("password=hunter2"), {
      ...silentLogger,
      error: errorLine,
    }).request("/");
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("hunter2");
    expect(errorLine).toHaveBeenCalledWith(
      "Unhandled request error",
      expect.objectContaining({ message: "password=hunter2" }),
    );
  });

  it("survives cyclic cause chains", async () => {
    const error = new Error("outer");
    error.cause = error;
    const response = await appThrowing(error).request("/");
    expect(response.status).toBe(500);
  });
});
