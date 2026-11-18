import { NextRequest, NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

const STORAGE_PATH = process.env.STORAGE_PATH || "C:/LotAgencia/storage/videos";
const STANDBY_DIR = path.join(path.dirname(STORAGE_PATH), "standby");
const allowed = new Map([
  ["jpg", "image/jpeg"], ["jpeg", "image/jpeg"], ["png", "image/png"], ["webp", "image/webp"],
]);

export async function GET() {
  const config = await prisma.systemConfig.findUnique({ where: { key: "STANDBY_IMAGE_FILENAME" } });
  if (!config?.value) return new NextResponse(null, { status: 404 });
  try {
    const ext = path.extname(config.value).slice(1).toLowerCase();
    const content = await readFile(path.join(STANDBY_DIR, path.basename(config.value)));
    return new NextResponse(content, {
      headers: { "Content-Type": allowed.get(ext) || "application/octet-stream", "Cache-Control": "no-cache" },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}

export async function POST(req: NextRequest) {
  const session = req.cookies.get("auth_session")?.value;
  const user = session ? await verifyToken(session) : null;
  if (user?.role !== "ADMIN") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Falta la imagen" }, { status: 400 });
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (!allowed.has(ext)) return NextResponse.json({ error: "Usá JPG, PNG o WebP" }, { status: 400 });
  if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: "La imagen supera 15 MB" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = `standby.${ext}`;
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  await mkdir(STANDBY_DIR, { recursive: true });
  await writeFile(path.join(STANDBY_DIR, filename), buffer);
  for (const [key, value] of [
    ["STANDBY_IMAGE_FILENAME", filename], ["STANDBY_IMAGE_SHA256", sha256],
  ] as const) {
    await prisma.systemConfig.upsert({ where: { key }, update: { value }, create: { key, value } });
  }
  return NextResponse.json({ success: true, sha256 });
}
