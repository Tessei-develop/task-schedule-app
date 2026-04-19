/**
 * Temporary debug endpoint — shows raw Google Calendar event data alongside
 * what our conversion code produces. Used to diagnose timezone issues.
 * DELETE THIS FILE after the timezone issue is resolved.
 */
import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { getAuthenticatedClient } from '@/lib/google-calendar'
import { addDays, addMonths } from 'date-fns'

async function getCalendarTimezone(calendar: ReturnType<typeof google.calendar>): Promise<string> {
  try {
    const res = await calendar.calendars.get({ calendarId: 'primary' })
    return res.data.timeZone ?? 'UTC'
  } catch {
    return 'UTC (fetch failed)'
  }
}

function extractLocalTime(dateTime: string, timeZone: string): string {
  const date = new Date(dateTime)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const hour   = parts.find(p => p.type === 'hour')?.value   ?? '00'
  const minute = parts.find(p => p.type === 'minute')?.value ?? '00'
  return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
}

function extractLocalDate(dateTime: string, timeZone: string): string {
  const date = new Date(dateTime)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const year  = parts.find(p => p.type === 'year')?.value  ?? ''
  const month = parts.find(p => p.type === 'month')?.value ?? ''
  const day   = parts.find(p => p.type === 'day')?.value   ?? ''
  return `${year}-${month}-${day}`
}

export async function GET() {
  try {
    const auth = await getAuthenticatedClient()
    const calendar = google.calendar({ version: 'v3', auth })
    const userTimeZone = await getCalendarTimezone(calendar)

    const res = await calendar.events.list({
      calendarId: 'primary',
      singleEvents: true,
      timeMin: addDays(new Date(), -7).toISOString(),
      timeMax: addMonths(new Date(), 1).toISOString(),
      maxResults: 10,
      orderBy: 'startTime',
    })

    const serverTz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const serverTime = new Date().toISOString()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const events = (res.data.items ?? []).map((event: any) => {
      const startDT = event.start?.dateTime ?? null
      const endDT   = event.end?.dateTime   ?? null
      const startDate = event.start?.date   ?? null
      const endDate   = event.end?.date     ?? null

      return {
        id: event.id,
        summary: event.summary,
        // Raw strings exactly as Google returned them
        raw: {
          'start.dateTime': startDT,
          'start.date':     startDate,
          'end.dateTime':   endDT,
          'end.date':       endDate,
          'start.timeZone': event.start?.timeZone ?? null,
          'end.timeZone':   event.end?.timeZone   ?? null,
        },
        // What our conversion code produces
        converted: startDT ? {
          startDate: extractLocalDate(startDT, userTimeZone),
          startTime: extractLocalTime(startDT, userTimeZone),
          endDate:   endDT ? extractLocalDate(endDT, userTimeZone) : null,
          endTime:   endDT ? extractLocalTime(endDT, userTimeZone) : null,
        } : {
          startDate: startDate,
          endDate:   endDate ? endDate : null,
          startTime: null,
          endTime:   null,
        },
      }
    })

    return NextResponse.json({
      serverTimezone:  serverTz,
      serverTimeUTC:   serverTime,
      calendarTimezone: userTimeZone,
      events,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
