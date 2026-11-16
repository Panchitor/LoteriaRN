import { prisma } from "@/lib/prisma";
import { deviceIdFromToken, isLegacyDeviceToken, verifyDeviceTokenHash } from "@/lib/deviceToken";

export async function authenticateDevice(token: unknown) {
  if (typeof token !== "string") return null;
  const deviceId = deviceIdFromToken(token);
  if (!deviceId) return null;

  const device = await prisma.device.findFirst({
    where: {
      id: deviceId,
      is_active: true,
      revoked_at: null,
      installation_id: { not: null },
    },
  });
  if (!device) return null;

  // Temporary compatibility for installations issued before secure tokens.
  // Once a device receives a hashed credential, its raw database ID is rejected.
  if (isLegacyDeviceToken(token)) return device.api_token_hash ? null : device;
  if (!device.api_token_hash) return null;
  return verifyDeviceTokenHash(token, device.api_token_hash) ? device : null;
}
