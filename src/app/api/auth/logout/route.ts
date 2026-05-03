import { NextResponse } from 'next/server'
import { AUTH_COOKIE_NAME } from '@/lib/auth'

export const runtime = 'edge'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(AUTH_COOKIE_NAME, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return res
}
