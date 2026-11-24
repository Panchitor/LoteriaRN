import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyToken } from './lib/auth'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export async function proxy(request: NextRequest) {
  const token = request.cookies.get('auth_session')?.value
  const { pathname } = request.nextUrl

  if (process.env.SERVER_MODE === 'STANDBY_READONLY' && !SAFE_METHODS.has(request.method)) {
    const message = 'Servidor de respaldo en modo de solo lectura.'
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'STANDBY_READONLY', message }, { status: 503 })
    }
    return new NextResponse(message, { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }

  const publicRoutes = [
    '/login', '/api/health', '/api/manifest', '/api/telemetry', '/api/register',
    '/api/videos', '/api/standby', '/api/logs', '/api/stats', '/api/device-control', '/apk',
    '/downloads', '/screenshots',
    '/logo-loteria-rn.png',
  ]
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    if (token && pathname.startsWith('/login')) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return NextResponse.next()
  }

  if (!token) {
    if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Sesión vencida. Volvé a iniciar sesión.' }, { status: 401 })
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const user = await verifyToken(token)
  if (!user) {
    if (pathname.startsWith('/api/')) {
      const response = NextResponse.json({ error: 'Sesión vencida. Volvé a iniciar sesión.' }, { status: 401 })
      response.cookies.delete('auth_session')
      return response
    }
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete('auth_session')
    return response
  }

  const adminRoutes = ['/users', '/settings', '/live', '/emergency', '/groups', '/api/admin/updates']
  if (user.role !== 'ADMIN' && adminRoutes.some(route => pathname.startsWith(route))) {
    if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    return NextResponse.redirect(new URL('/', request.url))
  }

  const response = NextResponse.next()
  response.headers.set('x-user-role', user.role)
  response.headers.set('x-user-username', user.username)
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
