import { NextRequest, NextResponse } from 'next/server'
import { storeTokens } from '@/lib/google-calendar'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(
      new URL('/dashboard?google=error', req.url)
    )
  }

  try {
    await storeTokens(code)
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
