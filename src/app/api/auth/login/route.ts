import { NextRequest, NextResponse } from 'next/server'
import {
  createSessionToken,
  timingSafeEqual,
  AUTH_COOKIE_NAME,
  AUTH_MAX_AGE_SEC,
} from '@/lib/auth'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  const password = process.env.APP_PASSWORD
  const secret = process.env.AUTH_SECRET

  if (!password || !secret) {
    return NextResponse.json({ error: 'Auth not configured' }, { status: 500 })
  }

  let body: { password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const provided = typeof body.password === 'string' ? body.password : ''

  if (!timingSafeEqual(provided, password)) {
    // Mild brute-force deterrent — adds a small delay on wrong password
    await new Promise((r) => setTimeout(r, 400))
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 })
  }

  const token = await createSessionToken(secret)
  const res = NextResponse.json({ ok: true })
  res.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: AUTH_MAX_AGE_SEC,
  })
  return res
}
