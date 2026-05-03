import { NextRequest, NextResponse } from 'next/server'
import { isValidSession, AUTH_COOKIE_NAME } from '@/lib/auth'

// Paths that must be reachable WITHOUT a valid session
const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/cron/',          // cron endpoints are protected by their own CRON_SECRET check
]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // If auth isn't configured (e.g. local dev), don't lock anything
  const password = process.env.APP_PASSWORD
  const secret = process.env.AUTH_SECRET
  if (!password || !secret) return NextResponse.next()

  const cookie = req.cookies.get(AUTH_COOKIE_NAME)?.value
  if (await isValidSession(cookie, secret)) return NextResponse.next()

  // For API requests, return 401 instead of redirecting
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // For page requests, redirect to /login with a `next` param so we can come back
  const loginUrl = req.nextUrl.clone()
  loginUrl.pathname = '/login'
  loginUrl.searchParams.set('next', pathname + req.nextUrl.search)
  return NextResponse.redirect(loginUrl)
}

// Run on every path EXCEPT static assets / Next internals / PWA files
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|workbox-|icons/).*)',
  ],
}
