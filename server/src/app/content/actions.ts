"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import fs from "fs";
import path from "path";
import { requireSession } from "@/lib/authorization";

const STORAGE_PATH = process.env.STORAGE_PATH || "C:/LotAgencia/storage/videos";

export async function deleteVideo(id: string) {
  await requireSession();
  try {
    const video = await prisma.video.findUnique({ where: { id } });
    if (!video) return { error: "Video no encontrado" };

    // Del DB
    await prisma.video.delete({ where: { id } });

    // Del Disk (video/image file)
    const filePath = path.join(STORAGE_PATH, video.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Del thumbnail if exists
    if (video.thumbnail_path && fs.existsSync(video.thumbnail_path)) {
      fs.unlinkSync(video.thumbnail_path);
    }
    
    revalidatePath("/content");
    return { success: true };
  } catch (e: any) {
    return { error: "Error al eliminar: " + e.message };
  }
}

export async function reorderVideos(orderedIds: string[]) {
  await requireSession();
  try {
    // Update each video's order field based on position in array
    const updates = orderedIds.map((id, index) =>
      prisma.video.update({
        where: { id },
        data: { order: index },
      })
    );
    await prisma.$transaction(updates);
    revalidatePath("/content");
    return { success: true };
  } catch (e: any) {
    return { error: "Error al reordenar: " + e.message };
  }
}

export async function updateImageDuration(id: string, duration: number) {
  await requireSession();
  if (!Number.isInteger(duration) || duration < 3 || duration > 3600) {
    return { error: "La duración debe estar entre 3 y 3600 segundos" };
  }
  const image = await prisma.video.findUnique({ where: { id } });
  if (!image || image.media_type !== "image") return { error: "Imagen no encontrada" };

  await prisma.video.update({
    where: { id },
    data: { display_duration: duration, duration_sec: duration },
  });
  revalidatePath("/content");
  return { success: true };
}
