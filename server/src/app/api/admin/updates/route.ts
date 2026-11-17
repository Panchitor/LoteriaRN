import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeFile, readdir, stat, unlink } from "fs/promises";
import { basename, join } from "path";
import { verifyToken } from "@/lib/auth";
import fs from "fs";
import { createHash } from "crypto";
import { readJsonBody, requestErrorResponse } from "@/lib/requestGuards";

export const dynamic = "force-dynamic";
const MAX_APK_SIZE = 150 * 1024 * 1024;

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get("auth_session")?.value;
  const user = token ? await verifyToken(token) : null;
  return user?.role === "ADMIN";
}

async function setConfig(key: string, value: string) {
  await prisma.systemConfig.upsert({ where: { key }, update: { value }, create: { key, value } });
}

function validVersion(version: string) {
  return /^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(version);
}

function versionFromFilename(filename: string): string {
  const match = filename.match(/v(\d+)[._](\d+)[._](\d+)/i);
  return match ? `${match[1]}.${match[2]}.${match[3]}` : "";
}

export async function POST(req: NextRequest) {
  try {
    if (!(await requireAdmin(req))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    const formData = await req.formData();
    const file = formData.get("apk") as File | null;
    const submittedVersion = String(formData.get("version") || "").trim();
    const channel = String(formData.get("channel") || "PILOT").toUpperCase();
    if (!file) return NextResponse.json({ error: "Falta el archivo APK" }, { status: 400 });
    const detectedVersion = versionFromFilename(file.name);
    const version = detectedVersion || submittedVersion;
    if (!validVersion(version) || (detectedVersion && submittedVersion && detectedVersion !== submittedVersion)) {
      return NextResponse.json({ error: "No se pudo detectar una versión válida en el nombre de la APK" }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".apk") || file.type && file.type !== "application/vnd.android.package-archive") {
      return NextResponse.json({ error: "El archivo no parece ser una APK válida" }, { status: 400 });
    }
    if (file.size < 1024 * 1024 || file.size > MAX_APK_SIZE) {
      return NextResponse.json({ error: "La APK debe pesar entre 1 MB y 150 MB" }, { status: 413 });
    }
    if (!['PILOT', 'STABLE'].includes(channel)) return NextResponse.json({ error: "Canal inválido" }, { status: 400 });

    const filename = `loteria-tv-v${version.replace(/[^A-Za-z0-9.-]/g, '_').replace(/\./g, '_')}.apk`;
    const uploadDir = join(process.cwd(), "public", "apk");
    fs.mkdirSync(uploadDir, { recursive: true });
    const apkBuffer = Buffer.from(await file.arrayBuffer());
    const sha256 = createHash("sha256").update(apkBuffer).digest("hex");
    await writeFile(join(uploadDir, filename), apkBuffer);
    // Next runs behind the proxy on localhost:3008; devices need the public origin.
    const origin = new URL(process.env.PUBLIC_APP_URL || 'https://loteriarn.patagonialive.media').origin;
    const url = `${origin}/apk/${filename}`;
    const prefix = channel === 'PILOT' ? 'PILOT' : 'LATEST';
    await prisma.$transaction([
      ...(channel === 'PILOT' ? [prisma.device.updateMany({ where: { update_channel: 'PILOT' }, data: { update_channel: 'STABLE' } })] : []),
      prisma.systemConfig.upsert({ where: { key: `${prefix}_APK_VERSION` }, update: { value: version }, create: { key: `${prefix}_APK_VERSION`, value: version } }),
      prisma.systemConfig.upsert({ where: { key: `${prefix}_APK_URL` }, update: { value: url }, create: { key: `${prefix}_APK_URL`, value: url } }),
      prisma.systemConfig.upsert({ where: { key: `${prefix}_APK_SHA256` }, update: { value: sha256 }, create: { key: `${prefix}_APK_SHA256`, value: sha256 } }),
    ]);
    return NextResponse.json({ success: true, version, url, sha256, channel });
  } catch (error) {
    console.error("APK upload error", error);
    return NextResponse.json({ error: "No se pudo publicar la APK" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const uploadDir = join(process.cwd(), "public", "apk");
  const [configs, devices] = await Promise.all([
    prisma.systemConfig.findMany({ where: { key: { in: ['LATEST_APK_VERSION', 'LATEST_APK_URL', 'LATEST_APK_SHA256', 'PILOT_APK_VERSION', 'PILOT_APK_URL', 'PILOT_APK_SHA256'] } } }),
    prisma.device.findMany({
      where: { is_active: true },
      select: { id: true, tv_number: true, app_version: true, update_channel: true, last_seen: true, device_model: true, agency: { select: { number: true, subagency_number: true, city: true } } },
      orderBy: [{ agency: { number: 'asc' } }, { tv_number: 'asc' }],
    }),
  ]);
  const config = Object.fromEntries(configs.map(c => [c.key, c.value]));
  const history: Array<{ filename: string; version: string; sizeBytes: number; createdAt: string }> = [];
  if (fs.existsSync(uploadDir)) {
    for (const file of await readdir(uploadDir)) {
      if (!file.endsWith('.apk')) continue;
      const info = await stat(join(uploadDir, file));
      const match = file.match(/loteria-tv-v(.*)\.apk/);
      history.push({ filename: file, version: match ? match[1].replace(/_/g, '.') : 'Desconocida', sizeBytes: info.size, createdAt: info.mtime.toISOString() });
    }
  }
  history.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return NextResponse.json({ history, config, devices });
}

export async function PATCH(req: NextRequest) {
  try {
    if (!(await requireAdmin(req))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    const body = await readJsonBody<{ action?: unknown; deviceIds?: unknown; channel?: unknown }>(req, 32 * 1024);
  if (body.action === 'assign') {
    const channel = typeof body.channel === "string" ? body.channel : "";
    const deviceIds = Array.isArray(body.deviceIds) && body.deviceIds.every(id => typeof id === "string") ? body.deviceIds : null;
    if (!deviceIds || !['PILOT', 'STABLE'].includes(channel)) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    await prisma.device.updateMany({ where: { id: { in: deviceIds }, is_active: true }, data: { update_channel: channel } });
    return NextResponse.json({ success: true });
  }
  if (body.action === 'promote') {
    const configs = await prisma.systemConfig.findMany({ where: { key: { in: ['PILOT_APK_VERSION', 'PILOT_APK_URL', 'PILOT_APK_SHA256'] } } });
    const version = configs.find(c => c.key === 'PILOT_APK_VERSION')?.value;
    const url = configs.find(c => c.key === 'PILOT_APK_URL')?.value;
    const sha256 = configs.find(c => c.key === 'PILOT_APK_SHA256')?.value;
    if (!version || !url || !sha256) return NextResponse.json({ error: "La APK piloto no tiene versión, URL y SHA-256 completos" }, { status: 400 });
    await prisma.$transaction([
      prisma.systemConfig.upsert({ where: { key: 'LATEST_APK_VERSION' }, update: { value: version }, create: { key: 'LATEST_APK_VERSION', value: version } }),
      prisma.systemConfig.upsert({ where: { key: 'LATEST_APK_URL' }, update: { value: url }, create: { key: 'LATEST_APK_URL', value: url } }),
      prisma.systemConfig.upsert({ where: { key: 'LATEST_APK_SHA256' }, update: { value: sha256 }, create: { key: 'LATEST_APK_SHA256', value: sha256 } }),
      prisma.device.updateMany({ where: { update_channel: 'PILOT' }, data: { update_channel: 'STABLE' } }),
    ]);
    return NextResponse.json({ success: true, version });
  }
  if (body.action === 'cancel') {
    await prisma.device.updateMany({ where: { update_channel: 'PILOT' }, data: { update_channel: 'STABLE' } });
    await setConfig('PILOT_APK_VERSION', '');
    await setConfig('PILOT_APK_URL', '');
    await setConfig('PILOT_APK_SHA256', '');
    return NextResponse.json({ success: true });
  }
    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  } catch (error) {
    const requestError = requestErrorResponse(error);
    if (requestError) return requestError;
    console.error("APK update action error", error);
    return NextResponse.json({ error: "No se pudo actualizar el canal" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!(await requireAdmin(req))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    const { filename } = await readJsonBody<{ filename?: unknown }>(req, 4 * 1024);
    const safeName = basename(String(filename || ''));
    if (!/^loteria-tv-v[A-Za-z0-9_.-]+\.apk$/.test(safeName)) return NextResponse.json({ error: "Archivo inválido" }, { status: 400 });
    const configs = await prisma.systemConfig.findMany({ where: { key: { in: ['LATEST_APK_URL', 'PILOT_APK_URL'] } } });
    if (configs.some(c => c.value.endsWith(`/${safeName}`))) return NextResponse.json({ error: "No se puede eliminar una APK activa" }, { status: 409 });
    const filePath = join(process.cwd(), "public", "apk", safeName);
    if (fs.existsSync(filePath)) await unlink(filePath);
    return NextResponse.json({ success: true });
  } catch (error) {
    const requestError = requestErrorResponse(error);
    if (requestError) return requestError;
    console.error("APK delete error", error);
    return NextResponse.json({ error: "No se pudo eliminar la APK" }, { status: 500 });
  }
}
