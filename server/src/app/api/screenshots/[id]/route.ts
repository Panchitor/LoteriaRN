import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.cookies.get('auth_session')?.value;
  if (!token || !await verifyToken(token)) return new NextResponse(null, { status: 401 });
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/i.test(id)) return new NextResponse(null, { status: 400 });
  const device = await prisma.device.findUnique({ where: { id }, select: { last_screenshot: true } });
  if (!device?.last_screenshot) return new NextResponse(null, { status: 404 });
  try {
    const image = await readFile(path.join(process.cwd(), 'public', 'screenshots', `${id}.jpg`));
    return new NextResponse(image, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, no-store' } });
  } catch { return new NextResponse(null, { status: 404 }); }
}
