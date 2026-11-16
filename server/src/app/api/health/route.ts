import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const mode = process.env.SERVER_MODE === 'STANDBY_READONLY' ? 'STANDBY_READONLY' : 'PRIMARY'
  return NextResponse.json(
    { ok: true, mode, timestamp: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
