import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorMessage } from "@/lib/errors";

type DeviceLogInput = { level?: unknown; message?: unknown };

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
    const device = await prisma.device.findFirst({
      where: { id: token, revoked_at: null, installation_id: { not: null } }
    });

    if (!device) {
      return NextResponse.json({ error: "Invalid device token" }, { status: 401 });
    }

    const logEntries = (logs as DeviceLogInput[]).map((log) => ({
      device_id: token,
      level: typeof log.level === 'string' ? log.level.slice(0, 20) : 'info',
      message: typeof log.message === 'string' ? log.message.slice(0, 2000) : '',
    }));

    if (logEntries.length > 0) {
      await prisma.deviceLog.createMany({
        data: logEntries
      });
    }

    return NextResponse.json({ success: true }, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  } catch (error: unknown) {
    console.error("LOGS ROUTE ERROR:", errorMessage(error));
    return NextResponse.json({ error: "Internal Error" }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
}
