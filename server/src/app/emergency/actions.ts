"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/authorization"

export async function getEmergencyState() {
  await requireAdmin();
  const configs = await prisma.systemConfig.findMany({
    where: {
      key: {
        in: ['EMERGENCY_ACTIVE', 'EMERGENCY_MESSAGE', 'EMERGENCY_BG_COLOR', 'EMERGENCY_TITLE_COLOR', 'EMERGENCY_MESSAGE_COLOR']
      }
    }
  });

  const isActive = configs.find(c => c.key === 'EMERGENCY_ACTIVE')?.value === 'true';
  const message = configs.find(c => c.key === 'EMERGENCY_MESSAGE')?.value || '';
  const backgroundColor = configs.find(c => c.key === 'EMERGENCY_BG_COLOR')?.value || '#7f1d1d';
  const titleColor = configs.find(c => c.key === 'EMERGENCY_TITLE_COLOR')?.value || '#ef4444';
  const messageColor = configs.find(c => c.key === 'EMERGENCY_MESSAGE_COLOR')?.value || '#ffffff';

  return { isActive, message, backgroundColor, titleColor, messageColor };
}

export async function toggleEmergency(isActive: boolean, message: string, colors: { backgroundColor: string; titleColor: string; messageColor: string }) {
  await requireAdmin();
  const validColor = (value: string) => /^#[0-9a-f]{6}$/i.test(value);
  if (![colors.backgroundColor, colors.titleColor, colors.messageColor].every(validColor)) {
    throw new Error('Colores inválidos');
  }
  await prisma.systemConfig.upsert({
    where: { key: 'EMERGENCY_ACTIVE' },
    update: { value: isActive ? 'true' : 'false' },
    create: { key: 'EMERGENCY_ACTIVE', value: isActive ? 'true' : 'false' }
  });

  for (const [key, value] of [
    ['EMERGENCY_BG_COLOR', colors.backgroundColor],
    ['EMERGENCY_TITLE_COLOR', colors.titleColor],
    ['EMERGENCY_MESSAGE_COLOR', colors.messageColor],
  ] as const) {
    await prisma.systemConfig.upsert({ where: { key }, update: { value }, create: { key, value } });
  }

  await prisma.systemConfig.upsert({
    where: { key: 'EMERGENCY_MESSAGE' },
    update: { value: message },
    create: { key: 'EMERGENCY_MESSAGE', value: message }
  });

  revalidatePath('/emergency');
  return { success: true };
}
