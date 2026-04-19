import { NextRequest, NextResponse } from 'next/server'
import { storeTokens } from '@/lib/google-calendar'

function getRedirectUri(req: NextRequest): string {
  const proto = req.headers.get('x-forwarded-proto') ?? 'http'
  const host  = req.headers.get('host') ?? 'localhost:3000'
  return `${proto}://${host}/api/google/callback`
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code  = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(
      new URL('/dashboard?google=error', req.url)
    )
  }

  try {
    // Must use the same redirect URI that was sent in the auth request
    await storeTokens(code, getRedirectUri(req))
    return NextResponse.redirect(
      new URL('/dashboard?google=connected', req.url)
    )
  } catch (err) {
    console.error('[Google OAuth callback error]', err)
    return NextResponse.redirect(
      new URL('/dashboard?google=error', req.url)
    )
  }
}
