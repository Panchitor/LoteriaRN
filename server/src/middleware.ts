import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyToken } from './lib/auth'

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_session')?.value
  const { pathname } = request.nextUrl
  
  // Public routes (Login + API Endpoints that the Android TVs use)
  if (pathname.startsWith('/login') || pathname.startsWith('/api/manifest') || pathname.startsWith('/api/telemetry') || pathname.startsWith('/api/register') || pathname.startsWith('/api/videos') || pathname.startsWith('/api/logs') || pathname.startsWith('/api/stats') || pathname.startsWith('/api/device-control') || pathname.startsWith('/apk') || pathname.startsWith('/downloads') || pathname.startsWith('/screenshots')) {
    if (token && pathname.startsWith('/login')) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return NextResponse.next()
  }

  // If no session, redirect to login
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const user = await verifyToken(token)
  if (!user) {
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete('auth_session')
    return response
  }

  // Authorize ADMIN-only routes
  const adminRoutes = ['/users', '/settings', '/live', '/api/admin']
  const isAdminRoute = adminRoutes.some(route => pathname.startsWith(route))
  
  if (user.role !== 'ADMIN' && isAdminRoute) {
    return NextResponse.redirect(new URL('/', request.url)) // Unauthorized Editor trying to access Admin
  }

  // Create a response and attach the user headers for Server Components to read if needed
  const response = NextResponse.next()
  response.headers.set('x-user-role', user.role)
  response.headers.set('x-user-username', user.username)
  
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/admin/updates|api/admin/videos|apk/).*)'
  ],
}
