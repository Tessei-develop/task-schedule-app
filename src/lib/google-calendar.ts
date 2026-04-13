import { google } from 'googleapis'
import { prisma } from './prisma'
import type { Task } from '@/types'
import { addHours, parseISO } from 'date-fns'

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
    refresh_token: token.refreshToken,
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
      refreshToken: tokens.refresh_token!,
      expiresAt: new Date(tokens.expiry_date!),
      scope: tokens.scope!,
      tokenType: tokens.token_type!,
    },
    update: {
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token ?? undefined,
      expiresAt: new Date(tokens.expiry_date!),
      scope: tokens.scope!,
      tokenType: tokens.token_type!,
    },
  })
}

function taskToEventBody(task: Task) {
  const start = task.startDate
    ? { dateTime: task.startDate }
    : task.dueDate
    ? { date: task.dueDate.split('T')[0] }
    : null

  const end = task.dueDate
    ? task.startDate
      ? { dateTime: addHours(parseISO(task.dueDate), 1).toISOString() }
      : { date: task.dueDate.split('T')[0] }
    : null

  return {
    summary: task.title,
    description: [
      task.description ?? '',
      '',
      '---',
      `Priority: ${task.priority}`,
      `Status: ${task.status}`,
      'Managed by Task Manager App',
    ].join('\n'),
    start: start ?? { date: new Date().toISOString().split('T')[0] },
    end: end ?? { date: new Date().toISOString().split('T')[0] },
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
  if (task.status === 'DONE') body.summary = `✓ DONE: ${task.title}`
  if (task.status === 'CANCELLED') body.summary = `CANCELLED: ${task.title}`
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
