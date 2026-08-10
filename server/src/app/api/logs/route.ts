import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const body = JSON.parse(rawBody);
    const { token, logs } = body;

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }
    if (!logs || !Array.isArray(logs)) {
      return NextResponse.json({ error: "Missing or invalid logs array" }, { status: 400 });
    }

    // Verify device exists
    const device = await prisma.device.findUnique({
      where: { id: token }
    });

    if (!device) {
      return NextResponse.json({ error: "Invalid device token" }, { status: 401 });
    }

    const logEntries = logs.map((log: any) => ({
      device_id: token,
      level: log.level || 'info',
      message: log.message || '',
    }));

    if (logEntries.length > 0) {
      await prisma.deviceLog.createMany({
        data: logEntries
      });
    }

    return NextResponse.json({ success: true }, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  } catch (err: any) {
    console.error("LOGS ROUTE ERROR:", err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
}
