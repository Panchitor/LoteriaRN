import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorMessage } from "@/lib/errors";
import { authenticateDevice } from "@/lib/deviceAuth";
import { enforceRateLimit, opaqueRateKey, readJsonBody, requestErrorResponse } from "@/lib/requestGuards";

export async function POST(req: NextRequest) {
  try {
    const body = await readJsonBody<{ token?: unknown; filename?: unknown; event?: unknown; completed?: unknown }>(req, 16 * 1024);
    const { token, completed } = body;
    const filename = typeof body.filename === "string" ? body.filename : "";
    const event = typeof body.event === "string" ? body.event : "";

    if (!token || !filename || !event) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    const limited = enforceRateLimit(req, "stats", opaqueRateKey(token), 240, 60 * 1000);
    if (limited) return limited;

    const device = await authenticateDevice(token);

    if (!device) {
      return NextResponse.json({ error: "Invalid device token" }, { status: 401 });
    }

    if (event === 'start') {
      await prisma.playbackStat.create({
        data: {
          device_id: device.id,
          filename,
        }
      });
    } else if (event === 'end') {
      const stat = await prisma.playbackStat.findFirst({
        where: { device_id: device.id, filename, ended_at: null },
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

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const requestError = requestErrorResponse(error);
    if (requestError) return requestError;
    console.error("STATS ROUTE ERROR:", errorMessage(error));
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
