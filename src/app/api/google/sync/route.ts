import { NextResponse } from 'next/server'
import { syncFromGoogleCalendar, isGoogleConnected } from '@/lib/google-calendar'

export async function POST() {
  if (!(await isGoogleConnected())) {
    return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 400 })
  }

  try {
    const result = await syncFromGoogleCalendar({ force: true })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[Google Calendar sync error]', err)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
