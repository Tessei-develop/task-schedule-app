import { NextResponse } from 'next/server'
import { syncFromGoogleCalendar, pushPendingTasksToGoogle, isGoogleConnected } from '@/lib/google-calendar'

export async function POST() {
  if (!(await isGoogleConnected())) {
    return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 400 })
  }

  try {
    // 1. Pull changes from Google Calendar → app (last-write-wins: app wins if newer)
    const pullResult = await syncFromGoogleCalendar({ force: true })

    // 2. Push app tasks that haven't made it to Google Calendar yet
    //    (handles first-time failures and any transient errors from earlier)
    const pushResult = await pushPendingTasksToGoogle()

    return NextResponse.json({
      ok: true,
      created:    pullResult.created,
      updated:    pullResult.updated,
      deleted:    pullResult.deleted,
      skipped:    pullResult.skipped,
      pushed:     pushResult.pushed,
      pushFailed: pushResult.failed,
    })
  } catch (err) {
    console.error('[Google Calendar sync error]', err)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
