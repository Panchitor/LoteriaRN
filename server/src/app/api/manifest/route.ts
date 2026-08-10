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
      tickers: parsedTickers
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });

  } catch (error) {
    return NextResponse.json({ error: "Internal Error" }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
}
