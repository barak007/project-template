import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const VERSION = "v1";
const KEY_LENGTH = 64;

const deriveKey = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keyLength: number,
) => Promise<Buffer>;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt, KEY_LENGTH);
  return [VERSION, salt.toString("base64url"), key.toString("base64url")].join(
    ".",
  );
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const [version, salt, key] = storedHash.split(".");
  if (version !== VERSION || !salt || !key) return false;
  const expected = Buffer.from(key, "base64url");
  const actual = await deriveKey(
    password,
    Buffer.from(salt, "base64url"),
    expected.length,
  );
  return timingSafeEqual(actual, expected);
}
