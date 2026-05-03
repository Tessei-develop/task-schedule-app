import { NextRequest, NextResponse } from 'next/server'
import {
  syncFromGoogleCalendar,
  pushPendingTasksToGoogle,
  isGoogleConnected,
} from '@/lib/google-calendar'

/**
 * Daily Google Calendar auto-sync.
 * Triggered by Vercel Cron (see vercel.json).
 *
 * Auth: Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` (env var).
 * We verify that header before doing any work — anyone hitting this endpoint
 * without it gets 401, so the middleware can safely whitelist /api/cron/.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!(await isGoogleConnected())) {
    return NextResponse.json({ ok: false, reason: 'not_connected' })
  }

  try {
    // Use incremental sync (no force) — daily cron should be a cheap delta fetch
    const pull = await syncFromGoogleCalendar({ force: false })
    const push = await pushPendingTasksToGoogle()
    return NextResponse.json({ ok: true, pull, push, ranAt: new Date().toISOString() })
  } catch (err) {
    console.error('[cron sync error]', err)
    return NextResponse.json({ ok: false, error: 'Sync failed' }, { status: 500 })
  }
}
