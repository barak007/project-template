import { describe, expect, it } from "vitest";

import { toApiError } from "../errors.js";

describe("toApiError", () => {
  it("maps the server's error envelope", async () => {
    const error = await toApiError({
      status: 403,
      json: () =>
        Promise.resolve({
          error: { code: "PERMISSION_DENIED", message: "Not allowed" },
        }),
    });
    expect(error.code).toBe("PERMISSION_DENIED");
    expect(error.message).toBe("Not allowed");
  });

  it("falls back to the status when the body is not an envelope", async () => {
    const error = await toApiError({
      status: 502,
      json: () => Promise.reject(new Error("not json")),
    });
    expect(error.code).toBe("REQUEST_FAILED");
    expect(error.message).toBe("Request failed with status 502");
  });

  it("fills envelope fields independently", async () => {
    const error = await toApiError({
      status: 500,
      json: () => Promise.resolve({ error: { code: "BOOM" } }),
    });
    expect(error.code).toBe("BOOM");
    expect(error.message).toBe("Request failed with status 500");
  });
});
