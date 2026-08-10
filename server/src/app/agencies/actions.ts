"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createAgency(data: FormData) {
  const name = data.get("name") as string;
  const number = Number(data.get("number"));

  if (!number) return { error: "El número es requerido" };

  try {
    await prisma.agency.create({
      data: {
        number,
        name: name || undefined,
      },
    });
    revalidatePath("/agencies");
    return { success: true };
  } catch (e: any) {
    if (e.code === 'P2002') return { error: "Esta agencia ya existe" };
    return { error: "Error al crear la agencia" };
  }
}

export async function deleteAgency(id: string) {
  try {
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
