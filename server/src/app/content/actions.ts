"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import fs from "fs";
import path from "path";

const STORAGE_PATH = process.env.STORAGE_PATH || "C:/LotAgencia/storage/videos";

export async function deleteVideo(id: string) {
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

