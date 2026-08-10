"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createGroup(name: string, color: string) {
  await prisma.deviceGroup.create({
    data: { name, color }
  });
  revalidatePath('/groups');
}

export async function deleteGroup(id: string) {
  await prisma.deviceGroup.delete({
    where: { id }
  });
  revalidatePath('/groups');
}

export async function assignDeviceToGroup(deviceId: string, groupId: string | null) {
  await prisma.device.update({
    where: { id: deviceId },
    data: { group_id: groupId }
  });
  revalidatePath('/groups');
  revalidatePath('/agencies');
}
