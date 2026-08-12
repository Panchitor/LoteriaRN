import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const body = JSON.parse(rawBody);
    const { token, filename, event, completed } = body;

    if (!token || !filename || !event) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const device = await prisma.device.findFirst({
      where: { id: token, revoked_at: null, installation_id: { not: null } }
    });

    if (!device) {
      return NextResponse.json({ error: "Invalid device token" }, { status: 401 });
    }

    if (event === 'start') {
      await prisma.playbackStat.create({
        data: {
          device_id: token,
          filename,
        }
      });
    } else if (event === 'end') {
      const stat = await prisma.playbackStat.findFirst({
        where: { device_id: token, filename, ended_at: null },
        orderBy: { started_at: 'desc' }
      });
      if (stat) {
        await prisma.playbackStat.update({
          where: { id: stat.id },
          data: {
            ended_at: new Date(),
            completed: completed === true || completed === 'true',
          }
        });
      }
    }

    return NextResponse.json({ success: true }, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  } catch (err: any) {
    console.error("STATS ROUTE ERROR:", err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
}
