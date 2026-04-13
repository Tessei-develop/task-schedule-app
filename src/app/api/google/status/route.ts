import { NextResponse } from 'next/server'
import { isGoogleConnected } from '@/lib/google-calendar'

export async function GET() {
  const connected = await isGoogleConnected()
  return NextResponse.json({ connected })
}
