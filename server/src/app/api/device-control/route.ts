import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { errorMessage } from "@/lib/errors";
import { authenticateDevice } from "@/lib/deviceAuth";
import { enforceRateLimit, opaqueRateKey, readJsonBody, requestErrorResponse } from "@/lib/requestGuards";

type DeviceControlBody = { token?: unknown; action?: unknown; imageBase64?: unknown; error?: unknown };

export async function POST(req: NextRequest) {
  try {
    const { token, action, imageBase64, error } = await readJsonBody<DeviceControlBody>(req, 12 * 1024 * 1024);
    if (!token || !action) return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    const limited = enforceRateLimit(req, "device-control", opaqueRateKey(token), 30, 60 * 1000);
    if (limited) return limited;
    const device = await authenticateDevice(token);
    if (!device) return NextResponse.json({ error: "DEVICE_REVOKED" }, { status: 401 });

    if (action === "screenshot") {
      if (error) {
        await prisma.device.update({ where: { id: device.id }, data: { screenshot_requested: false, last_command: "screenshot", last_command_status: `error: ${String(error).slice(0, 300)}`, last_command_at: new Date() } });
        return NextResponse.json({ success: false });
      }
      if (!imageBase64 || typeof imageBase64 !== "string") return NextResponse.json({ error: "Captura vacía" }, { status: 400 });
      const image = Buffer.from(imageBase64, "base64");
      if (!image.length || image.length > 8 * 1024 * 1024) return NextResponse.json({ error: "Captura inválida" }, { status: 400 });
      const directory = path.join(process.cwd(), "public", "screenshots");
      await mkdir(directory, { recursive: true });
      const filename = `${device.id}.jpg`;
      await writeFile(path.join(directory, filename), image);
      const capturedAt = new Date();
      await prisma.device.update({
        where: { id: device.id },
        data: { screenshot_requested: false, last_screenshot: `/screenshots/${filename}`, screenshot_at: capturedAt, last_command: "screenshot", last_command_status: "success", last_command_at: capturedAt },
      });
      return NextResponse.json({ success: true });
    }

    if (action === "restart_ack") {
      await prisma.device.update({
        where: { id: device.id },
        data: { restart_requested: false, last_command: "restart", last_command_status: error ? `error: ${String(error).slice(0, 300)}` : "accepted", last_command_at: new Date() },
      });
      return NextResponse.json({ success: !error });
    }

    return NextResponse.json({ error: "Acción desconocida" }, { status: 400 });
  } catch (error: unknown) {
    const requestError = requestErrorResponse(error);
    if (requestError) return requestError;
    console.error("DEVICE CONTROL ERROR:", errorMessage(error));
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
