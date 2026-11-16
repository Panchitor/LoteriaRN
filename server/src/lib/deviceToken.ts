import { createHash, randomBytes, timingSafeEqual } from "crypto";

const DEVICE_TOKEN_SECRET_BYTES = 32;
const DEVICE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function hashDeviceToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createDeviceToken(deviceId: string): { token: string; hash: string } {
  if (!DEVICE_ID_PATTERN.test(deviceId)) throw new Error("INVALID_DEVICE_ID");
  const secret = randomBytes(DEVICE_TOKEN_SECRET_BYTES).toString("base64url");
  const token = `${deviceId}.${secret}`;
  return { token, hash: hashDeviceToken(token) };
}

export function deviceIdFromToken(token: string): string | null {
  if (!token || token.length > 200) return null;
  const separator = token.indexOf(".");
  const deviceId = separator === -1 ? token : token.slice(0, separator);
  return DEVICE_ID_PATTERN.test(deviceId) ? deviceId : null;
}

export function isLegacyDeviceToken(token: string): boolean {
  return !token.includes(".") && DEVICE_ID_PATTERN.test(token);
}

export function verifyDeviceTokenHash(token: string, expectedHash: string): boolean {
  if (!/^[0-9a-f]{64}$/i.test(expectedHash)) return false;
  const actual = Buffer.from(hashDeviceToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
