import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeFile, readdir, stat, unlink } from "fs/promises";
import { join } from "path";
import { verifyToken } from "@/lib/auth";
import fs from "fs";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('auth_session')?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = await verifyToken(token);
    if (user?.role !== 'ADMIN') return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const formData = await req.formData();
    const file = formData.get("apk") as File | null;
    const version = formData.get("version") as string;

    if (!file || !version) {
      return NextResponse.json({ error: "Falta el archivo o la versión." }, { status: 400 });
    }

    if (!file.name.endsWith('.apk')) {
      return NextResponse.json({ error: "El archivo debe ser un .apk válido." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Save to public folder
    const filename = `loteria-tv-v${version.replace(/\./g, '_')}.apk`;
    const uploadDir = join(process.cwd(), "public", "apk");
    
    // Ensure dir exists
    if (!fs.existsSync(uploadDir)){
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = join(uploadDir, filename);
    await writeFile(filePath, buffer);

    // Get current host URL (to construct full download URL)
    const host = req.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const fullUrl = `${protocol}://${host}/apk/${filename}`;

    // Update System Configs
    await prisma.systemConfig.upsert({
      where: { key: "LATEST_APK_VERSION" },
      update: { value: version },
      create: { key: "LATEST_APK_VERSION", value: version }
    });

    await prisma.systemConfig.upsert({
      where: { key: "LATEST_APK_URL" },
      update: { value: fullUrl },
      create: { key: "LATEST_APK_URL", value: fullUrl }
    });

    return NextResponse.json({ success: true, url: fullUrl, version });

  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Error interno al subir el archivo." }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('auth_session')?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = await verifyToken(token);
    if (user?.role !== 'ADMIN') return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const uploadDir = join(process.cwd(), "public", "apk");
    if (!fs.existsSync(uploadDir)) {
      return NextResponse.json({ history: [] });
    }

    const files = await readdir(uploadDir);
    const history = [];

    for (const file of files) {
      if (file.endsWith('.apk')) {
        const filePath = join(uploadDir, file);
        const fileStat = await stat(filePath);
        // Parse version from loteria-tv-v1_0_3.apk
        const match = file.match(/loteria-tv-v(.*)\.apk/);
        const version = match ? match[1].replace(/_/g, '.') : 'Desconocida';

        history.push({
          filename: file,
          version,
          sizeBytes: fileStat.size,
          createdAt: fileStat.birthtime.toISOString()
        });
      }
    }

    // Sort newest first
    history.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ history });
  } catch (error) {
    console.error("History fetch error:", error);
    return NextResponse.json({ error: "Error interno al obtener historial." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const token = req.cookies.get('auth_session')?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = await verifyToken(token);
    if (user?.role !== 'ADMIN') return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { filename } = await req.json();
    if (!filename || !filename.endsWith('.apk')) {
      return NextResponse.json({ error: "Archivo inválido." }, { status: 400 });
    }

    const filePath = join(process.cwd(), "public", "apk", filename);
    if (fs.existsSync(filePath)) {
      await unlink(filePath);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json({ error: "Error interno al eliminar archivo." }, { status: 500 });
  }
}
