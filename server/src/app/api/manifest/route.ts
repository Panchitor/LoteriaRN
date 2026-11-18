import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const videosRaw = await prisma.video.findMany({
      orderBy: [{ order: "asc" }, { created_at: "asc" }],
    });
    const tickersRaw = await prisma.ticker.findMany({
      where: { is_active: true },
      orderBy: { created_at: "asc" },
    });
    const standbyConfigs = await prisma.systemConfig.findMany({
      where: { key: { in: ["STANDBY_IMAGE_FILENAME", "STANDBY_IMAGE_SHA256"] } },
    });
    const standbyFilename = standbyConfigs.find(c => c.key === "STANDBY_IMAGE_FILENAME")?.value;
    const standbySha256 = standbyConfigs.find(c => c.key === "STANDBY_IMAGE_SHA256")?.value;

    const parsedContent = videosRaw
      .filter(v => Number(v.size_bytes) > 0)
      .map(v => ({
        ...v,
        size_bytes: Number(v.size_bytes),
        media_type: v.media_type,
        display_duration: v.display_duration,
      }));

    const parsedTickers = tickersRaw.map(t => ({
      text: t.text,
      speed: t.speed,
      position: t.position,
      bg_color: t.bg_color,
      text_color: t.text_color
    }));

    // Generate a dynamic version that changes on ANY video or ticker change
    const versionHash = videosRaw.reduce((acc, v) => acc + v.created_at.getTime(), videosRaw.length)
      + tickersRaw.reduce((acc, t) => acc + t.created_at.getTime(), tickersRaw.length);

    return NextResponse.json({
      version: versionHash,
      videos: parsedContent,
      tickers: parsedTickers,
      standby: standbyFilename ? { url: "/api/standby", filename: standbyFilename, hash_sha256: standbySha256 || null } : null,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });

  } catch {
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
