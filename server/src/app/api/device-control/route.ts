import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";

async function authorizedDevice(token: string) {
  return prisma.device.findFirst({
    where: { id: token, revoked_at: null, installation_id: { not: null } },
  });
}

export async function POST(req: NextRequest) {
  try {
    const { token, action, imageBase64, error } = await req.json();
    if (!token || !action) return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    const device = await authorizedDevice(String(token));
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
  } catch (err: any) {
    console.error("DEVICE CONTROL ERROR:", err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
