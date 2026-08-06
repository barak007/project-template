import { describe, expect, it } from "vitest";

import { SecretCipher } from "../crypto/secrets.js";

describe("SecretCipher", () => {
  const cipher = new SecretCipher(Buffer.alloc(32, 7).toString("base64"));

  it("round trips values without deterministic ciphertext", () => {
    const first = cipher.encrypt("secret");
    const second = cipher.encrypt("secret");
    expect(first).not.toBe(second);
    expect(cipher.decrypt(first)).toBe("secret");
  });

  it("rejects keys that are not exactly 32 bytes", () => {
    expect(() => new SecretCipher(Buffer.alloc(16).toString("base64"))).toThrow(
      /32 bytes/,
    );
  });

  it("rejects payloads from unknown versions", () => {
    const encrypted = cipher.encrypt("secret");
    expect(() => cipher.decrypt(`v9${encrypted.slice(2)}`)).toThrow(
      /Unsupported/,
    );
    expect(() => cipher.decrypt("v1.only-two")).toThrow(/Unsupported/);
  });

  it("detects tampering", () => {
    const encrypted = cipher.encrypt("secret");
    const parts = encrypted.split(".");
    const payload = parts[3];
    if (!payload) throw new Error("Encrypted fixture is malformed");
    parts[3] = `${payload.startsWith("A") ? "B" : "A"}${payload.slice(1)}`;
    expect(() => cipher.decrypt(parts.join("."))).toThrow();
  });
});
