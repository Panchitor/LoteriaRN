"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/authorization";
import { randomInt } from "crypto";

const ACTIVATION_DURATIONS: Record<string, number> = {
  "30m": 30 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
  "3d": 3 * 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "20d": 20 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

function createNumericCode() {
  return randomInt(10_000_000, 100_000_000).toString();
}

export async function createAgency(data: FormData) {
  await requireAdmin();
  const number = Number(data.get("number"));
  const subagencyNumberRaw = data.get("subagency_number") as string;
  const subagencyNumber = subagencyNumberRaw ? Number(subagencyNumberRaw) : null;
  const tvNumber = Number(data.get("tv_number"));
  const city = (data.get("city") as string)?.trim();
  const activationDuration = (data.get("activation_duration") as string) || "20d";
  const code = subagencyNumber ? `${number}-${subagencyNumber}` : `${number}`;

  if (!number || !tvNumber || !city) return { error: "Agencia, TV y ciudad son obligatorios" };
  if (subagencyNumberRaw && !subagencyNumber) return { error: "El número de subagencia no es válido" };
  if (!ACTIVATION_DURATIONS[activationDuration]) return { error: "El vencimiento seleccionado no es válido" };

  try {
    const activationCode = createNumericCode();
    const expiresAt = new Date(Date.now() + ACTIVATION_DURATIONS[activationDuration]);
    await prisma.$transaction(async (tx) => {
      const agency = await tx.agency.upsert({
        where: { code },
        update: { city },
        create: { number, subagency_number: subagencyNumber, code, city },
      });
      const device = await tx.device.create({ data: { agency_id: agency.id, tv_number: tvNumber } });
      await tx.deviceActivationCode.create({
        data: { code: activationCode, device_id: device.id, expires_at: expiresAt },
      });
    });
    revalidatePath("/agencies");
    return { success: true, activationCode, expiresAt: expiresAt.toISOString() };
  } catch (e: any) {
    if (e.code === 'P2002') return { error: "Ese número de TV ya existe en la agencia/subagencia" };
    return { error: "Error al crear la agencia" };
  }
}

export async function deleteAgency(id: string) {
  await requireAdmin();
  try {
    const childCount = await prisma.agency.count({ where: { parent_id: id } });
    if (childCount > 0) return { error: "No se puede eliminar una agencia con subagencias" };
    // Primero eliminar todos los dispositivos asociados a esta agencia
    await prisma.device.deleteMany({
      where: { agency_id: id },
    });
    
    // Luego eliminar la agencia
    await prisma.agency.delete({
      where: { id },
    });
    revalidatePath("/agencies");
    return { success: true };
  } catch (e) {
    return { error: "Error al eliminar" };
  }
}

export async function unlinkDevice(deviceId: string) {
  await requireAdmin();
  await prisma.device.update({
    where: { id: deviceId },
    data: { installation_id: null, revoked_at: new Date(), status: "offline" },
  });
  await prisma.deviceActivationCode.updateMany({
    where: { device_id: deviceId, used_at: null },
    data: { used_at: new Date() },
  });
  revalidatePath("/agencies");
  return { success: true };
}

export async function setDeviceActive(deviceId: string, isActive: boolean) {
  await requireAdmin();
  await prisma.device.update({
    where: { id: deviceId },
    data: { is_active: isActive },
  });
  revalidatePath("/agencies");
  revalidatePath("/monitoring");
  revalidatePath("/alerts");
  revalidatePath("/");
  return { success: true };
}

export async function generateDeviceActivationCode(deviceId: string, duration: string) {
  await requireAdmin();
  if (!ACTIVATION_DURATIONS[duration]) return { error: "El vencimiento seleccionado no es válido" };
  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device) return { error: "Dispositivo no encontrado" };

  const activationCode = createNumericCode();
  const expiresAt = new Date(Date.now() + ACTIVATION_DURATIONS[duration]);
  await prisma.$transaction([
    prisma.deviceActivationCode.updateMany({
      where: { device_id: deviceId, used_at: null },
      data: { used_at: new Date() },
    }),
    prisma.deviceActivationCode.create({
      data: { code: activationCode, device_id: deviceId, expires_at: expiresAt },
    }),
  ]);
  return { success: true, activationCode, expiresAt: expiresAt.toISOString() };
}
