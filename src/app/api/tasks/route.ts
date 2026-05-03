import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { isOverdue, isDueToday } from '@/lib/date-utils'
import { createCalendarEvent, isGoogleConnected } from '@/lib/google-calendar'
import { generateOccurrenceDates, MAX_OCCURRENCES } from '@/lib/recurrence'
import type { Task, RecurrenceType } from '@/types'

const TIME_RE = /^\d{2}:\d{2}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const TaskSchema = z.object({
  title:              z.string().min(1, 'Title is required').max(255),
  description:        z.string().max(10000).optional().nullable(),
  status:             z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED']).optional(),
  priority:           z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  startDate:          z.string().regex(DATE_RE).optional().nullable(),
  dueDate:            z.string().regex(DATE_RE).optional().nullable(),
  startTime:          z.string().regex(TIME_RE).optional().nullable(),
  endTime:            z.string().regex(TIME_RE).optional().nullable(),
  estimatedMinutes:   z.number().int().min(1).max(86400).optional().nullable(),
  tags:               z.array(z.string().max(50)).max(20).optional(),
  recurrence:         z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'WEEKDAY', 'WEEKEND']).optional().nullable(),
  recurrenceInterval: z.number().int().min(1).max(365).optional().nullable(),
  recurrenceEndDate:  z.string().regex(DATE_RE).optional().nullable(),
})

function serializeTask(t: Awaited<ReturnType<typeof prisma.task.findFirst>>): Task {
  if (!t) throw new Error('Task not found')
  return {
    ...t,
    startDate: t.startDate?.toISOString() ?? null,
    dueDate: t.dueDate?.toISOString() ?? null,
    completedAt: t.completedAt?.toISOString() ?? null,
    recurrenceEndDate: t.recurrenceEndDate?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    status: t.status as Task['status'],
    priority: t.priority as Task['priority'],
    recurrence: (t.recurrence as Task['recurrence']) ?? null,
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const statusParam   = searchParams.get('status')
    const priorityParam = searchParams.get('priority')
    const tagsParam     = searchParams.get('tags')
    const rawSearch   = searchParams.get('search')
    const rawDateFrom = searchParams.get('dateFrom')
    const rawDateTo   = searchParams.get('dateTo')
    const overdueOnly = searchParams.get('overdue') === 'true'
    const todayOnly   = searchParams.get('dueToday') === 'true'

    // Sanitize search: trim and enforce max length
    const search = rawSearch ? rawSearch.trim().slice(0, 500) || null : null

    // Validate date params — reject anything that doesn't match YYYY-MM-DD
    const dateFrom = rawDateFrom && DATE_RE.test(rawDateFrom) ? rawDateFrom : null
    const dateTo   = rawDateTo   && DATE_RE.test(rawDateTo)   ? rawDateTo   : null

    // Parse comma-separated multi-value filters
    const statuses   = statusParam   ? statusParam.split(',').filter(Boolean)   : []
    const priorities = priorityParam ? priorityParam.split(',').filter(Boolean) : []
    const tags       = tagsParam     ? tagsParam.split(',').filter(Boolean)     : []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}
    if (statuses.length === 1)   where.status   = statuses[0]
    if (statuses.length > 1)     where.status   = { in: statuses }
    if (priorities.length === 1) where.priority = priorities[0]
    if (priorities.length > 1)   where.priority = { in: priorities }
    // Tags: task must contain ALL selected tags (every tag is present in the array)
    if (tags.length > 0)         where.tags = { hasEvery: tags }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (dateFrom || dateTo) {
      where.dueDate = {}
      if (dateFrom) where.dueDate.gte = new Date(dateFrom)
      if (dateTo)   where.dueDate.lte = new Date(dateTo)
    }

    const rawTasks = await prisma.task.findMany({ where })

    let tasks = rawTasks.map(serializeTask)

    // Sort by date + time together so tasks with a start time appear in
    // chronological order within the same day.
    // Rules:
    //   1. No dueDate → pushed to the very end
    //   2. Same date: tasks with a startTime sort before tasks without one
    //   3. Same date + same startTime (or both absent): sort by createdAt desc
    tasks.sort((a, b) => {
      const dateA = a.dueDate ? a.dueDate.slice(0, 10) : '9999-99-99'
      const dateB = b.dueDate ? b.dueDate.slice(0, 10) : '9999-99-99'
      if (dateA !== dateB) return dateA < dateB ? -1 : 1

      const timeA = a.startTime ?? '99:99'
      const timeB = b.startTime ?? '99:99'
      if (timeA !== timeB) return timeA < timeB ? -1 : 1

      // Tiebreak: newer first
      return b.createdAt < a.createdAt ? -1 : b.createdAt > a.createdAt ? 1 : 0
    })

    if (overdueOnly) tasks = tasks.filter((t: Task) => isOverdue(t.dueDate, t.status, t.endTime))
    if (todayOnly)   tasks = tasks.filter((t: Task) => isDueToday(t.dueDate))

    return NextResponse.json({ tasks, total: tasks.length })
  } catch (err) {
    console.error('[GET /api/tasks]', err)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = TaskSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', issues: parsed.error.issues }, { status: 400 })
    }
    const data = parsed.data

    // ── Validate recurrence configuration ────────────────────────────────────
    // To bulk-generate occurrences we need an end date AND a due date as the
    // anchor for stepping. Reject ambiguous combos with a clear error.
    if (data.recurrence) {
      if (!data.dueDate) {
        return NextResponse.json(
          { error: 'A due date is required when recurrence is set.' },
          { status: 400 },
        )
      }
      if (!data.recurrenceEndDate) {
        return NextResponse.json(
          { error: 'A recurrence end date is required so the series has a stop point.' },
          { status: 400 },
        )
      }
      if (data.recurrenceEndDate < data.dueDate) {
        return NextResponse.json(
          { error: 'Recurrence end date must be on or after the due date.' },
          { status: 400 },
        )
      }
    }

    // ── Create the FIRST occurrence ──────────────────────────────────────────
    const baseFields = {
      title: data.title,
      description: data.description ?? null,
      status: data.status ?? 'TODO',
      priority: data.priority ?? 'MEDIUM',
      estimatedMinutes: data.estimatedMinutes ?? null,
      startTime: data.startTime ?? null,
      endTime: data.endTime ?? null,
      tags: data.tags ?? [],
    }

    // Stamp every task in a recurring series with the same seriesId so the
    // group can later be queried / updated together. crypto.randomUUID is
    // available on the Node.js runtime API routes use.
    const seriesId = data.recurrence ? crypto.randomUUID() : null

    const firstTask = await prisma.task.create({
      data: {
        ...baseFields,
        startDate: data.startDate ? new Date(data.startDate) : null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        recurrence: data.recurrence ?? null,
        recurrenceInterval: data.recurrenceInterval ?? null,
        recurrenceEndDate: data.recurrenceEndDate ? new Date(data.recurrenceEndDate) : null,
        seriesId,
      },
    })

    // ── Generate all subsequent occurrences in the DB ────────────────────────
    let occurrencesCreated = 0
    let cappedAtMax = false
    if (data.recurrence && data.dueDate && data.recurrenceEndDate) {
      const additional = generateOccurrenceDates({
        firstStart: data.startDate ? new Date(data.startDate) : null,
        firstDue:   new Date(data.dueDate),
        endDate:    new Date(data.recurrenceEndDate),
        type:       data.recurrence as RecurrenceType,
        interval:   data.recurrenceInterval ?? 1,
      })

      cappedAtMax = additional.length === MAX_OCCURRENCES

      if (additional.length > 0) {
        await prisma.task.createMany({
          data: additional.map(({ start, due }) => ({
            ...baseFields,
            startDate: start,
            dueDate:   due,
            // Each occurrence carries the same recurrence metadata so the badge
            // still renders, but we no longer auto-spawn on DONE.
            recurrence:         data.recurrence ?? null,
            recurrenceInterval: data.recurrenceInterval ?? null,
            recurrenceEndDate:  data.recurrenceEndDate ? new Date(data.recurrenceEndDate) : null,
            seriesId,
            // googleCalendarSynced defaults to false — the next sync (manual
            // button or 7AM cron) will push these to Google Calendar.
          })),
        })
        occurrencesCreated = additional.length
      }
    }

    // ── Push the first occurrence to Google Calendar synchronously ───────────
    let serialized = serializeTask(firstTask)
    if (await isGoogleConnected()) {
      try {
        const eventId = await createCalendarEvent(serialized)
        const updated = await prisma.task.update({
          where: { id: firstTask.id },
          data: { googleCalendarEventId: eventId, googleCalendarSynced: true },
        })
        serialized = serializeTask(updated)
      } catch (syncErr) {
        console.error('[Google Calendar create sync error]', syncErr)
        // googleCalendarSynced stays false — push-pending will retry on next sync
      }
    }

    return NextResponse.json(
      { task: serialized, occurrencesCreated, cappedAtMax },
      { status: 201 },
    )
  } catch (err) {
    console.error('[POST /api/tasks]', err)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}
