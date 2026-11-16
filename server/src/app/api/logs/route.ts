import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorMessage } from "@/lib/errors";
import { authenticateDevice } from "@/lib/deviceAuth";
import { enforceRateLimit, opaqueRateKey, readJsonBody, requestErrorResponse } from "@/lib/requestGuards";

type DeviceLogInput = { level?: unknown; message?: unknown };

export async function POST(req: NextRequest) {
  try {
    const body = await readJsonBody<{ token?: unknown; logs?: unknown }>(req, 128 * 1024);
    const { token, logs } = body;

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }
    if (!logs || !Array.isArray(logs) || logs.length > 100) {
      return NextResponse.json({ error: "Missing or invalid logs array" }, { status: 400 });
    }
    const limited = enforceRateLimit(req, "logs", opaqueRateKey(token), 120, 60 * 1000);
    if (limited) return limited;

    // Verify device exists
    const device = await authenticateDevice(token);

    if (!device) {
      return NextResponse.json({ error: "Invalid device token" }, { status: 401 });
    }

    const logEntries = (logs as DeviceLogInput[]).map((log) => ({
      device_id: device.id,
      level: typeof log.level === 'string' ? log.level.slice(0, 20) : 'info',
      message: typeof log.message === 'string' ? log.message.slice(0, 2000) : '',
    }));

    if (logEntries.length > 0) {
      await prisma.deviceLog.createMany({
        data: logEntries
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const requestError = requestErrorResponse(error);
    if (requestError) return requestError;
    console.error("LOGS ROUTE ERROR:", errorMessage(error));
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
