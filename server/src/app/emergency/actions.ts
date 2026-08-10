"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function getEmergencyState() {
  const configs = await prisma.systemConfig.findMany({
    where: {
      key: {
        in: ['EMERGENCY_ACTIVE', 'EMERGENCY_MESSAGE']
      }
    }
  });

  const isActive = configs.find(c => c.key === 'EMERGENCY_ACTIVE')?.value === 'true';
  const message = configs.find(c => c.key === 'EMERGENCY_MESSAGE')?.value || '';

  return { isActive, message };
}

export async function toggleEmergency(isActive: boolean, message: string) {
  await prisma.systemConfig.upsert({
    where: { key: 'EMERGENCY_ACTIVE' },
    update: { value: isActive ? 'true' : 'false' },
    create: { key: 'EMERGENCY_ACTIVE', value: isActive ? 'true' : 'false' }
  });

  await prisma.systemConfig.upsert({
    where: { key: 'EMERGENCY_MESSAGE' },
    update: { value: message },
    create: { key: 'EMERGENCY_MESSAGE', value: message }
  });

  revalidatePath('/emergency');
  return { success: true };
}
