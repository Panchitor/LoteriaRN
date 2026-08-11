import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeFile, unlink, readFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";

const STORAGE_PATH = process.env.STORAGE_PATH || "C:/LotAgencia/storage/videos";
const MAX_FILE_SIZE = 400 * 1024 * 1024; // 400 MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const displayDurationStr = formData.get("display_duration") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No se proporcionó ningún archivo" }, { status: 400 });
    }

    const ext = file.name.toLowerCase().split('.').pop() || '';
    const allowedVideo = ['mp4'];
    const allowedImage = ['jpg', 'jpeg', 'png', 'webp'];
    const isVideo = allowedVideo.includes(ext);
    const isImage = allowedImage.includes(ext);

    if (!isVideo && !isImage) {
      return NextResponse.json({ error: "Solo se permiten archivos .mp4, .jpg, .png, .webp" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "El archivo supera el límite de 400 MB" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Generate MD5 hash for client validation (only immediately useful for images)
    const hashSum = crypto.createHash("md5");
    hashSum.update(buffer);
    const hexHash = hashSum.digest("hex");

    // Save with a unique filename to prevent overrides of same name but different content
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-]/g, "_");
    const uniqueFilename = `${Date.now()}_${safeName}`;
    const filePath = path.join(STORAGE_PATH, uniqueFilename);
    const tempFilePath = path.join(STORAGE_PATH, `temp_${uniqueFilename}`);

    // Ensure directory exists
    if (!fs.existsSync(STORAGE_PATH)) {
      fs.mkdirSync(STORAGE_PATH, { recursive: true });
    }

    if (isVideo) {
      await writeFile(tempFilePath, buffer);
    } else {
      await writeFile(filePath, buffer);
    }

    const media_type = isImage ? "image" : "video";
    const requestedDuration = parseInt(displayDurationStr || "10", 10);
    if (isImage && (!Number.isInteger(requestedDuration) || requestedDuration < 3 || requestedDuration > 3600)) {
      return NextResponse.json({ error: "La duración debe estar entre 3 y 3600 segundos" }, { status: 400 });
    }
    const display_duration = isImage ? requestedDuration : 0;
    const duration_sec = isImage ? display_duration : 60; // Mock video duration

    // Get the current max order value
    const maxOrder = await prisma.video.aggregate({ _max: { order: true } });
    const nextOrder = (maxOrder._max.order ?? -1) + 1;

    const video = await prisma.video.create({
      data: {
        filename: uniqueFilename,
        original_name: isVideo ? `[Procesando] ${file.name}` : file.name,
        size_bytes: isVideo ? 0 : file.size,
        duration_sec,
        hash_md5: isVideo ? "processing" : hexHash,
        media_type,
        display_duration,
        order: nextOrder,
      },
    });

    if (isVideo) {
      // Background compression task
      (async () => {
        try {
          await new Promise((resolve, reject) => {
            ffmpeg(tempFilePath)
              .outputOptions([
                "-vf scale=-2:720", // Reduce to 720p height maximum, keep aspect ratio
                "-c:v libx264",
                "-crf 28",          // Good compression ratio vs quality
                "-preset veryfast",
                "-c:a aac",
                "-b:a 128k",
                "-ar 44100",
                "-movflags +faststart" // Optimize for web streaming
              ])
              .save(filePath)
              .on("end", () => resolve(true))
              .on("error", (err) => reject(err));
          });

          // Delete temporary file
          await unlink(tempFilePath);

          // Get new size and hash
          const newBuffer = await readFile(filePath);
          const newHashSum = crypto.createHash("md5");
          newHashSum.update(newBuffer);
          const newHexHash = newHashSum.digest("hex");

          await prisma.video.update({
            where: { id: video.id },
            data: {
              original_name: file.name,
              size_bytes: newBuffer.length,
              hash_md5: newHexHash
            }
          });
        } catch (err) {
          console.error("FFmpeg Compression Error:", err);
          await prisma.video.update({
            where: { id: video.id },
            data: {
              original_name: "[Error de compresión] " + file.name
            }
          });
        }
      })();
    }

    const safeVideo = {
      ...video,
      size_bytes: Number(video.size_bytes),
    };

    return NextResponse.json({ success: true, video: safeVideo });
  } catch (err: any) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Error interno al procesar el archivo" }, { status: 500 });
  }
}
