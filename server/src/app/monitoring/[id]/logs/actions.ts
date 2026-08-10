import { prisma } from "@/lib/prisma";

export async function getDeviceLogs(deviceId: string) {
  return await prisma.deviceLog.findMany({
    where: { device_id: deviceId },
    orderBy: { created_at: 'desc' },
    take: 200,
  });
}
