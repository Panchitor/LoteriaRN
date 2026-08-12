import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeFile, readdir, stat, unlink } from "fs/promises";
import { basename, join } from "path";
import { verifyToken } from "@/lib/auth";
import fs from "fs";

export const dynamic = "force-dynamic";

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

export async function POST(req: NextRequest) {
  try {
    if (!(await requireAdmin(req))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    const formData = await req.formData();
    const file = formData.get("apk") as File | null;
    const version = String(formData.get("version") || "").trim();
    const channel = String(formData.get("channel") || "PILOT").toUpperCase();
    if (!file || !validVersion(version)) return NextResponse.json({ error: "Archivo o versión inválidos" }, { status: 400 });
    if (!file.name.toLowerCase().endsWith(".apk") || file.size < 1024 * 1024) return NextResponse.json({ error: "El archivo no parece ser una APK válida" }, { status: 400 });
    if (!['PILOT', 'STABLE'].includes(channel)) return NextResponse.json({ error: "Canal inválido" }, { status: 400 });

    const filename = `loteria-tv-v${version.replace(/[^A-Za-z0-9.-]/g, '_').replace(/\./g, '_')}.apk`;
    const uploadDir = join(process.cwd(), "public", "apk");
    fs.mkdirSync(uploadDir, { recursive: true });
    await writeFile(join(uploadDir, filename), Buffer.from(await file.arrayBuffer()));
    const origin = new URL(req.url).origin;
    const url = `${origin}/apk/${filename}`;
    const prefix = channel === 'PILOT' ? 'PILOT' : 'LATEST';
    await prisma.$transaction([
      prisma.systemConfig.upsert({ where: { key: `${prefix}_APK_VERSION` }, update: { value: version }, create: { key: `${prefix}_APK_VERSION`, value: version } }),
      prisma.systemConfig.upsert({ where: { key: `${prefix}_APK_URL` }, update: { value: url }, create: { key: `${prefix}_APK_URL`, value: url } }),
    ]);
    return NextResponse.json({ success: true, version, url, channel });
  } catch (error) {
    console.error("APK upload error", error);
    return NextResponse.json({ error: "No se pudo publicar la APK" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const uploadDir = join(process.cwd(), "public", "apk");
  const [configs, devices] = await Promise.all([
    prisma.systemConfig.findMany({ where: { key: { in: ['LATEST_APK_VERSION', 'LATEST_APK_URL', 'PILOT_APK_VERSION', 'PILOT_APK_URL'] } } }),
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
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const body = await req.json();
  if (body.action === 'assign') {
    if (!Array.isArray(body.deviceIds) || !['PILOT', 'STABLE'].includes(body.channel)) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    await prisma.device.updateMany({ where: { id: { in: body.deviceIds }, is_active: true }, data: { update_channel: body.channel } });
    return NextResponse.json({ success: true });
  }
  if (body.action === 'promote') {
    const configs = await prisma.systemConfig.findMany({ where: { key: { in: ['PILOT_APK_VERSION', 'PILOT_APK_URL'] } } });
    const version = configs.find(c => c.key === 'PILOT_APK_VERSION')?.value;
    const url = configs.find(c => c.key === 'PILOT_APK_URL')?.value;
    if (!version || !url) return NextResponse.json({ error: "No hay una APK piloto activa" }, { status: 400 });
    await prisma.$transaction([
      prisma.systemConfig.upsert({ where: { key: 'LATEST_APK_VERSION' }, update: { value: version }, create: { key: 'LATEST_APK_VERSION', value: version } }),
      prisma.systemConfig.upsert({ where: { key: 'LATEST_APK_URL' }, update: { value: url }, create: { key: 'LATEST_APK_URL', value: url } }),
      prisma.device.updateMany({ where: { update_channel: 'PILOT' }, data: { update_channel: 'STABLE' } }),
    ]);
    return NextResponse.json({ success: true, version });
  }
  if (body.action === 'cancel') {
    await prisma.device.updateMany({ where: { update_channel: 'PILOT' }, data: { update_channel: 'STABLE' } });
    await setConfig('PILOT_APK_VERSION', '');
    await setConfig('PILOT_APK_URL', '');
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { filename } = await req.json();
  const safeName = basename(String(filename || ''));
  if (!/^loteria-tv-v[A-Za-z0-9_.-]+\.apk$/.test(safeName)) return NextResponse.json({ error: "Archivo inválido" }, { status: 400 });
  const configs = await prisma.systemConfig.findMany({ where: { key: { in: ['LATEST_APK_URL', 'PILOT_APK_URL'] } } });
  if (configs.some(c => c.value.endsWith(`/${safeName}`))) return NextResponse.json({ error: "No se puede eliminar una APK activa" }, { status: 409 });
  const filePath = join(process.cwd(), "public", "apk", safeName);
  if (fs.existsSync(filePath)) await unlink(filePath);
  return NextResponse.json({ success: true });
}
