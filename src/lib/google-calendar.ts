import { google } from 'googleapis'
import { prisma } from './prisma'
import type { Task } from '@/types'
import { addDays, addMonths } from 'date-fns'

// Marker so we can skip app-created events during reverse sync
const APP_MARKER = 'Managed by Task Manager App'

const PRIORITY_COLOR_IDS: Record<string, string> = {
  URGENT: '11', // tomato
  HIGH: '6',    // tangerine
  MEDIUM: '9',  // blueberry
  LOW: '2',     // sage
}

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )
}

export async function isGoogleConnected(): Promise<boolean> {
  try {
    const token = await prisma.googleToken.findUnique({ where: { id: 'singleton' } })
    return !!token
  } catch {
    return false
  }
}

export async function getAuthenticatedClient() {
  const token = await prisma.googleToken.findUnique({ where: { id: 'singleton' } })
  if (!token) throw new Error('Google Calendar not connected')

  const oauth2Client = getOAuth2Client()
  oauth2Client.setCredentials({
    access_token: token.accessToken,
    refresh_token: token.refreshToken ?? undefined,
    expiry_date: token.expiresAt.getTime(),
  })

  // Auto-refresh if expired
  if (new Date() >= token.expiresAt) {
    const { credentials } = await oauth2Client.refreshAccessToken()
    await prisma.googleToken.update({
      where: { id: 'singleton' },
      data: {
        accessToken: credentials.access_token!,
        expiresAt: new Date(credentials.expiry_date!),
      },
    })
    oauth2Client.setCredentials(credentials)
  }

  return oauth2Client
}

export function getAuthUrl(): string {
  const oauth2Client = getOAuth2Client()
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    prompt: 'consent',
  })
}

export async function storeTokens(code: string): Promise<void> {
  const oauth2Client = getOAuth2Client()
  const { tokens } = await oauth2Client.getToken(code)
  await prisma.googleToken.upsert({
    where: { id: 'singleton' },
    create: {
      id: 'singleton',
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token ?? null,
      expiresAt: new Date(tokens.expiry_date!),
      scope: tokens.scope ?? '',
      tokenType: tokens.token_type ?? 'Bearer',
    },
    update: {
      accessToken: tokens.access_token!,
      ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
      expiresAt: new Date(tokens.expiry_date!),
      scope: tokens.scope ?? '',
      tokenType: tokens.token_type ?? 'Bearer',
      // Reset sync token on re-auth so next sync is a full refresh
      syncToken: null,
    },
  })
}

// ─── App → Google Calendar ────────────────────────────────────────────────────

/** Add N days to a "YYYY-MM-DD" string and return a new "YYYY-MM-DD" string. */
function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function taskToEventBody(task: Task) {
  // Use startDate for the event start, dueDate for the event end.
  const duePart   = task.dueDate   ? task.dueDate.slice(0, 10)   : new Date().toISOString().slice(0, 10)
  const startPart = task.startDate ? task.startDate.slice(0, 10) : duePart

  type EventDateTime = { date?: string; dateTime?: string; timeZone?: string }
  let start: EventDateTime
  let end: EventDateTime

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

  if (task.startTime && task.endTime) {
    // Fully timed event — guard against endTime ≤ startTime (e.g. overnight
    // events stored with corrupted times). Fall back to all-day if invalid.
    if (task.endTime > task.startTime) {
      start = { dateTime: `${startPart}T${task.startTime}:00`, timeZone }
      end   = { dateTime: `${duePart}T${task.endTime}:00`,     timeZone }
    } else {
      // Invalid range → treat as all-day to avoid Google rejecting the event
      start = { date: startPart }
      end   = { date: shiftDate(duePart, 1) }
    }
  } else if (task.startTime) {
    // Start time only — end = start + 1 hour (capped at 23:59)
    const [h, m] = task.startTime.split(':').map(Number)
    const endH = Math.min(h + 1, 23)
    start = { dateTime: `${startPart}T${task.startTime}:00`, timeZone }
    end   = { dateTime: `${duePart}T${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`, timeZone }
  } else {
    // All-day event: Google Calendar end is exclusive, so add 1 day to dueDate
    // so the event visually covers startDate through dueDate inclusive.
    start = { date: startPart }
    end   = { date: shiftDate(duePart, 1) }
  }

  const descLines = [
    task.description ?? '',
    '',
    '---',
    `Priority: ${task.priority}`,
    `Status: ${task.status}`,
    APP_MARKER,
  ]

  return {
    summary: task.title,
    description: descLines.join('\n'),
    start,
    end,
    colorId: PRIORITY_COLOR_IDS[task.priority] ?? '9',
  }
}

export async function createCalendarEvent(task: Task): Promise<string> {
  const auth = await getAuthenticatedClient()
  const calendar = google.calendar({ version: 'v3', auth })
  const res = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: taskToEventBody(task),
  })
  return res.data.id!
}

export async function updateCalendarEvent(task: Task): Promise<void> {
  if (!task.googleCalendarEventId) return
  const auth = await getAuthenticatedClient()
  const calendar = google.calendar({ version: 'v3', auth })
  const body = taskToEventBody(task)
  if (task.status === 'DONE') body.summary = `✓ ${task.title}`
  if (task.status === 'CANCELLED') body.summary = `✗ ${task.title}`
  await calendar.events.update({
    calendarId: 'primary',
    eventId: task.googleCalendarEventId,
    requestBody: body,
  })
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const auth = await getAuthenticatedClient()
  const calendar = google.calendar({ version: 'v3', auth })
  await calendar.events.delete({ calendarId: 'primary', eventId })
}

// ─── Google Calendar → App ────────────────────────────────────────────────────

/** Extract a local-tz "HH:MM" time string from a Google dateTime value. */
function extractTime(dateTime: string): string {
  const d = new Date(dateTime)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Extract a "YYYY-MM-DD" date string from a Google dateTime / date value. */
function extractDate(dateTime: string): string {
  const d = new Date(dateTime)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function eventToTaskFields(event: any) {
  const isTimedEvent = !!(event.start?.dateTime)

  // For all-day events Google returns the end as an exclusive date (the day
  // after the last visible day). Subtract 1 day to get the actual due date.
  const rawDueDate = event.end?.dateTime
    ? extractDate(event.end.dateTime)
    : event.end?.date ?? null
  const dueDate = rawDueDate && !isTimedEvent
    ? shiftDate(rawDueDate, -1)
    : rawDueDate

  const startDate = event.start?.dateTime
    ? extractDate(event.start.dateTime)
    : event.start?.date ?? null

  const startTime = isTimedEvent && event.start?.dateTime
    ? extractTime(event.start.dateTime)
    : null

  const endTime = isTimedEvent && event.end?.dateTime
    ? extractTime(event.end.dateTime)
    : null

  return {
    title: (event.summary ?? 'Untitled').replace(/^[✓✗]\s*/, ''),
    description: event.description
      ? event.description
          .split('\n---\n')[0]  // strip our metadata footer
          .trim() || null
      : null,
    dueDate: dueDate ? new Date(dueDate) : null,
    startDate: startDate ? new Date(startDate) : null,
    startTime,
    endTime,
  }
}

export interface SyncResult {
  created: number
  updated: number
  deleted: number
}

/**
 * Pull changes from Google Calendar into the task database.
 * Uses incremental sync (syncToken) so subsequent calls only fetch deltas.
 * Pass `force: true` to discard the stored syncToken and do a full re-fetch
 * (used for manual "Sync from Google" so no recent edits are missed).
 */
export async function syncFromGoogleCalendar(options?: { force?: boolean }): Promise<SyncResult> {
  const auth = await getAuthenticatedClient()
  const calendar = google.calendar({ version: 'v3', auth })
  const tokenRow = await prisma.googleToken.findUnique({ where: { id: 'singleton' } })

  // On forced full sync, clear the stored token so we fetch everything fresh
  if (options?.force && tokenRow?.syncToken) {
    await prisma.googleToken.update({ where: { id: 'singleton' }, data: { syncToken: null } })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params: any = { calendarId: 'primary', singleEvents: true }

  if (!options?.force && tokenRow?.syncToken) {
    params.syncToken = tokenRow.syncToken
  } else {
    // First sync: fetch from 30 days ago to 6 months ahead
    params.timeMin = addDays(new Date(), -30).toISOString()
    params.timeMax = addMonths(new Date(), 6).toISOString()
    params.maxResults = 2500
  }

  let created = 0, updated = 0, deleted = 0
  let pageToken: string | undefined
  let nextSyncToken: string | undefined

  do {
    if (pageToken) params.pageToken = pageToken

    // Google returns 410 Gone when a syncToken is invalid — fall back to full sync
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let res: any
    try {
      res = await calendar.events.list(params)
    } catch (err: unknown) {
      const e = err as { code?: number }
      if (e?.code === 410 && params.syncToken) {
        // Token expired — reset and retry as full sync
        await prisma.googleToken.update({ where: { id: 'singleton' }, data: { syncToken: null } })
        delete params.syncToken
        params.timeMin = addDays(new Date(), -30).toISOString()
        params.timeMax = addMonths(new Date(), 6).toISOString()
        params.maxResults = 2500
        res = await calendar.events.list(params)
      } else {
        throw err
      }
    }

    nextSyncToken = res.data.nextSyncToken ?? undefined
    pageToken = res.data.nextPageToken ?? undefined

    for (const event of (res.data.items ?? [])) {
      if (!event.id) continue

      // Find existing linked task first — needed for both deleted and updated paths
      const existing = await prisma.task.findFirst({
        where: { googleCalendarEventId: event.id },
      })

      // Handle deleted events
      if (event.status === 'cancelled') {
        if (existing) {
          await prisma.task.delete({ where: { id: existing.id } })
          deleted++
        }
        continue
      }

      const fields = eventToTaskFields(event)

      if (existing) {
        // Always update linked tasks — this covers app-created events that the
        // user later edited in Google Calendar (they still carry APP_MARKER but
        // we must reflect the user's changes back into the app).
        await prisma.task.update({
          where: { id: existing.id },
          data: { ...fields, googleCalendarSynced: true },
        })
        updated++
      } else {
        // For unlinked events: skip ones originally created by this app.
        // They would only appear here if the task was already deleted from
        // the app, so re-importing them would create phantom duplicates.
        if (event.description?.includes(APP_MARKER)) continue

        await prisma.task.create({
          data: {
            ...fields,
            status: 'TODO',
            priority: 'MEDIUM',
            googleCalendarEventId: event.id,
            googleCalendarSynced: true,
          },
        })
        created++
      }
    }
  } while (pageToken)

  if (nextSyncToken) {
    await prisma.googleToken.update({
      where: { id: 'singleton' },
      data: { syncToken: nextSyncToken },
    })
  }

  return { created, updated, deleted }
}
