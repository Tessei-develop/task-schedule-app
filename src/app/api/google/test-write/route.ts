/**
 * Temporary: test Google Calendar write access and return the full error.
 * DELETE after diagnosis is complete.
 */
import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { getAuthenticatedClient } from '@/lib/google-calendar'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const auth = await getAuthenticatedClient()
    const calendar = google.calendar({ version: 'v3', auth })

    // 1. Check token scope stored in DB
    const token = await prisma.googleToken.findUnique({ where: { id: 'singleton' } })
    const scopeStored = token?.scope ?? '(none)'

    // 2. Try inserting a test event (we'll delete it immediately)
    let insertResult: string
    let eventId: string | null = null
    try {
      const res = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: {
          summary: 'APP TEST EVENT — DELETE ME',
          start: { date: new Date().toISOString().slice(0, 10) },
          end:   { date: new Date(Date.now() + 86400000).toISOString().slice(0, 10) },
        },
      })
      eventId = res.data.id ?? null
      insertResult = `OK — created event id=${eventId}`
    } catch (e: unknown) {
      const err = e as { code?: number; message?: string; errors?: unknown }
      insertResult = `FAILED: code=${err.code} message=${err.message} errors=${JSON.stringify(err.errors)}`
    }

    // 3. If insert worked, delete the test event
    let deleteResult = 'skipped'
    if (eventId) {
      try {
        await calendar.events.delete({ calendarId: 'primary', eventId })
        deleteResult = 'OK'
      } catch (e: unknown) {
        const err = e as { code?: number; message?: string }
        deleteResult = `FAILED: code=${err.code} message=${err.message}`
      }
    }

    // 4. Count pending tasks
    const pendingCount = await prisma.task.count({ where: { googleCalendarSynced: false } })

    return NextResponse.json({
      scopeStored,
      insertResult,
      deleteResult,
      pendingTaskCount: pendingCount,
    })
  } catch (err: unknown) {
    const e = err as { message?: string; stack?: string }
    return NextResponse.json({ error: e.message, stack: e.stack }, { status: 500 })
  }
}
