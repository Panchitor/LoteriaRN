"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/authorization";

export async function saveConfigs(configs: { key: string; value: string }[]) {
  await requireAdmin();
  try {
    for (const config of configs) {
      if (config.key.trim() === '') continue;
      
      await prisma.systemConfig.upsert({
        where: { key: config.key },
        update: { value: config.value },
        create: { key: config.key, value: config.value },
      });
    }
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    console.error("Error saving configs:", error);
    return { success: false, error: "No se pudieron guardar las configuraciones." };
  }
}

export async function deleteConfig(key: string) {
  await requireAdmin();
  try {
    await prisma.systemConfig.delete({
      where: { key }
    });
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    return { success: false, error: "No se pudo eliminar la configuración." };
  }
}
