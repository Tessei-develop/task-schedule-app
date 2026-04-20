/**
 * Temporary: diagnose why pending tasks fail to push to Google Calendar.
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

    // Fetch the 6 pending tasks
    const pending = await prisma.task.findMany({
      where: { googleCalendarSynced: false },
    })

    const results = await Promise.all(pending.map(async (task) => {
      // Build exactly the same event body pushPendingTasksToGoogle would build
      const duePart   = task.dueDate
        ? task.dueDate.toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10)
      const startPart = task.startDate
        ? task.startDate.toISOString().slice(0, 10)
        : duePart

      let start: Record<string, string>
      let end: Record<string, string>
      const timeZone = process.env.USER_TIMEZONE ?? 'UTC'

      if (task.startTime && task.endTime && task.endTime > task.startTime) {
        start = { dateTime: `${startPart}T${task.startTime}:00`, timeZone }
        end   = { dateTime: `${duePart}T${task.endTime}:00`, timeZone }
      } else if (task.startTime) {
        const [h, m] = task.startTime.split(':').map(Number)
        const endH = Math.min(h + 1, 23)
        start = { dateTime: `${startPart}T${task.startTime}:00`, timeZone }
        end   = { dateTime: `${duePart}T${String(endH).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`, timeZone }
      } else {
        const d = new Date(duePart + 'T00:00:00')
        d.setDate(d.getDate() + 1)
        const endDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
        start = { date: startPart }
        end   = { date: endDate }
      }

      const body = {
        summary: task.title,
        description: `${task.description ?? ''}\n\n---\nPriority: ${task.priority}\nStatus: ${task.status}`,
        start,
        end,
      }

      // Try the push (same logic as pushPendingTasksToGoogle)
      let outcome: string
      try {
        if (task.googleCalendarEventId) {
          await calendar.events.update({
            calendarId: 'primary',
            eventId: task.googleCalendarEventId,
            requestBody: body,
          })
          outcome = 'update OK'
        } else {
          const res = await calendar.events.insert({
            calendarId: 'primary',
            requestBody: body,
          })
          outcome = `insert OK — new eventId=${res.data.id}`
        }
      } catch (e: unknown) {
        const err = e as { code?: number; message?: string; errors?: unknown; response?: { data?: unknown } }
        outcome = `FAILED code=${err.code} message=${err.message} responseData=${JSON.stringify(err.response?.data)}`
      }

      return {
        taskId: task.id,
        title: task.title,
        googleCalendarEventId: task.googleCalendarEventId,
        startDate: task.startDate?.toISOString().slice(0,10),
        dueDate:   task.dueDate?.toISOString().slice(0,10),
        startTime: task.startTime,
        endTime:   task.endTime,
        eventBody: body,
        outcome,
      }
    }))

    return NextResponse.json({ pendingCount: pending.length, results })
  } catch (err: unknown) {
    const e = err as { message?: string; stack?: string }
    return NextResponse.json({ error: e.message, stack: e.stack }, { status: 500 })
  }
}
