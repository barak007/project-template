import { describe, expect, it } from "vitest";

import { SecretCipher } from "../src/crypto/secrets.js";

describe("SecretCipher", () => {
  const cipher = new SecretCipher(Buffer.alloc(32, 7).toString("base64"));

  it("round trips values without deterministic ciphertext", () => {
    const first = cipher.encrypt("secret");
    const second = cipher.encrypt("secret");
    expect(first).not.toBe(second);
    expect(cipher.decrypt(first)).toBe("secret");
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
