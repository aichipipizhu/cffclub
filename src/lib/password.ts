import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  const [algorithm, saltBase64, hashBase64] = passwordHash.split("$");
  if (algorithm !== "scrypt" || !saltBase64 || !hashBase64) {
    return false;
  }

  const expected = Buffer.from(hashBase64, "base64url");
  const actual = (await scrypt(password, Buffer.from(saltBase64, "base64url"), expected.length)) as Buffer;

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

