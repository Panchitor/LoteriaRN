"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authorization";
import { revalidatePath } from "next/cache";
import { canIssueRemoteCommand } from "@/lib/remoteCommands";

async function onlineDevice(deviceId: string) {
  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device) return { error: "El equipo no existe." } as const;
  if (!canIssueRemoteCommand(device)) return { error: "El equipo está offline. La orden no fue guardada." } as const;
  return { device } as const;
}

export async function requestDeviceScreenshot(deviceId: string) {
  await requireAdmin();
  const target = await onlineDevice(deviceId);
  if ("error" in target) return { success: false, error: target.error };
  await prisma.device.update({
    where: { id: deviceId },
    data: {
      screenshot_requested: true,
      last_command: "screenshot",
      last_command_status: "pending",
      last_command_at: new Date(),
      restart_requested: false,
    },
  });
  revalidatePath(`/monitoring/${deviceId}`);
  return { success: true };
}

export async function requestDeviceRestart(deviceId: string) {
  await requireAdmin();
  const target = await onlineDevice(deviceId);
  if ("error" in target) return { success: false, error: target.error };
  await prisma.device.update({
    where: { id: deviceId },
    data: {
      restart_requested: true,
      last_command: "restart",
      last_command_status: "pending",
      last_command_at: new Date(),
      screenshot_requested: false,
    },
  });
  revalidatePath(`/monitoring/${deviceId}`);
  return { success: true };
}
