"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createTicker(formData: FormData) {
  const text = formData.get("text") as string;
  const speed = parseInt(formData.get("speed") as string) || 50;
  const position = formData.get("position") as string || "bottom";
  const bg_color = formData.get("bg_color") as string || "#000000CC";
  const text_color = formData.get("text_color") as string || "#FFFFFF";

  if (!text) {
    throw new Error("Text is required");
  }

  await prisma.ticker.create({
    data: {
      text,
      speed,
      position,
      bg_color,
      text_color,
      is_active: true,
    },
  });

  revalidatePath("/ticker");
}

export async function toggleTicker(id: string, is_active: boolean) {
  await prisma.ticker.update({
    where: { id },
    data: { is_active },
  });

  revalidatePath("/ticker");
}

export async function deleteTicker(id: string) {
  await prisma.ticker.delete({
    where: { id },
  });

  revalidatePath("/ticker");
}
