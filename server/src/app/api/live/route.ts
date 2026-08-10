import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    let liveEvent = await prisma.liveEvent.findFirst();
    
    // Fallback default just in case it doesn't exist
    if (!liveEvent) {
      liveEvent = { 
        id: "default", 
        is_active: false, 
        url: "http://canal10str.ddns.net:8088/Forquera2/video.m3u8", 
        created_at: new Date() 
      };
    }

    return NextResponse.json({
      live: liveEvent.is_active,
      url: liveEvent.url,
      timestamp: Date.now()
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
      }
    });

  } catch (error) {
    return NextResponse.json({ live: false, error: "Internal Error" }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
}
