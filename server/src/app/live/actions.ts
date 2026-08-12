"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/authorization";

export async function getLiveState() {
  await requireAdmin();
  let liveEvent = await prisma.liveEvent.findFirst();
  if (!liveEvent) {
    liveEvent = await prisma.liveEvent.create({
      data: {
        id: "default",
        is_active: false,
        url: "http://canal10str.ddns.net:8088/Forquera2/video.m3u8",
      },
    });
  }
  
  const config = await prisma.systemConfig.findFirst({
    where: { key: 'FLUSSONIC_POLL_INTERVAL' }
  });
  
  return {
    ...liveEvent,
    pollInterval: config ? parseInt(config.value, 10) : 10
  };
}

export async function toggleLive(isActive: boolean, url: string, pollInterval: number) {
  await requireAdmin();
  const liveEvent = await getLiveState();
  
  await prisma.liveEvent.update({
    where: { id: liveEvent.id },
    data: {
      is_active: isActive,
      url: url,
    },
  });

  // Update SystemConfig for poll interval and base URL (so watchdog sees it)
  await prisma.systemConfig.upsert({
    where: { key: 'FLUSSONIC_POLL_INTERVAL' },
    update: { value: pollInterval.toString() },
    create: { key: 'FLUSSONIC_POLL_INTERVAL', value: pollInterval.toString() }
  });
  
  await prisma.systemConfig.upsert({
    where: { key: 'FLUSSONIC_BASE_URL' },
    update: { value: url },
    create: { key: 'FLUSSONIC_BASE_URL', value: url }
  });

  revalidatePath("/live");
  revalidatePath("/");
  return { success: true };
}
