"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authorization";
import { revalidatePath } from "next/cache";

export async function requestDeviceScreenshot(deviceId: string) {
  await requireAdmin();
  await prisma.device.update({
    where: { id: deviceId },
    data: {
      screenshot_requested: true,
      last_command: "screenshot",
      last_command_status: "pending",
      last_command_at: new Date(),
    },
  });
  revalidatePath(`/monitoring/${deviceId}`);
  return { success: true };
}

export async function requestDeviceRestart(deviceId: string) {
  await requireAdmin();
  await prisma.device.update({
    where: { id: deviceId },
    data: {
      restart_requested: true,
      last_command: "restart",
      last_command_status: "pending",
      last_command_at: new Date(),
    },
  });
  revalidatePath(`/monitoring/${deviceId}`);
  return { success: true };
}
