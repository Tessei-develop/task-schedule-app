import { NextRequest, NextResponse } from 'next/server'
import { getAuthUrl } from '@/lib/google-calendar'

/**
 * Build the redirect URI from the incoming request so it works both
 * on localhost and on any deployment URL without changing env vars.
 */
function getRedirectUri(req: NextRequest): string {
  // x-forwarded-proto is set by Vercel (and most reverse proxies) to "https"
  const proto = req.headers.get('x-forwarded-proto') ?? 'http'
  const host  = req.headers.get('host') ?? 'localhost:3000'
  return `${proto}://${host}/api/google/callback`
}

export async function GET(req: NextRequest) {
  const url = getAuthUrl(getRedirectUri(req))
  return NextResponse.redirect(url)
}
