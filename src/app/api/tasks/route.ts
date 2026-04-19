import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { isOverdue, isDueToday } from '@/lib/date-utils'
import { createCalendarEvent, isGoogleConnected } from '@/lib/google-calendar'
import type { Task } from '@/types'

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
  recurrence:         z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']).optional().nullable(),
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
  const { searchParams } = new URL(req.url)
  const statusParam   = searchParams.get('status')
  const priorityParam = searchParams.get('priority')
  const tagsParam     = searchParams.get('tags')
  const search    = searchParams.get('search')
  const dateFrom  = searchParams.get('dateFrom')
  const dateTo    = searchParams.get('dateTo')
  const overdueOnly = searchParams.get('overdue') === 'true'
  const todayOnly   = searchParams.get('dueToday') === 'true'

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
    if (dateTo) where.dueDate.lte = new Date(dateTo)
  }

  const rawTasks = await prisma.task.findMany({
    where,
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
  })

  let tasks = rawTasks.map(serializeTask)
  if (overdueOnly) tasks = tasks.filter((t: Task) => isOverdue(t.dueDate, t.status, t.endTime))
  if (todayOnly) tasks = tasks.filter((t: Task) => isDueToday(t.dueDate))

  return NextResponse.json({ tasks, total: tasks.length })
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  const parsed = TaskSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', issues: parsed.error.issues }, { status: 400 })
  }
  const data = parsed.data

  const task = await prisma.task.create({
    data: {
      title: data.title,
      description: data.description ?? null,
      status: data.status ?? 'TODO',
      priority: data.priority ?? 'MEDIUM',
      startDate: data.startDate ? new Date(data.startDate) : null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      estimatedMinutes: data.estimatedMinutes ?? null,
      startTime: data.startTime ?? null,
      endTime: data.endTime ?? null,
      tags: data.tags ?? [],
      recurrence: data.recurrence ?? null,
      recurrenceInterval: data.recurrenceInterval ?? null,
      recurrenceEndDate: data.recurrenceEndDate ? new Date(data.recurrenceEndDate) : null,
    },
  })

  const serialized = serializeTask(task)

  if (await isGoogleConnected()) {
    try {
      const eventId = await createCalendarEvent(serialized)
      const updated = await prisma.task.update({
        where: { id: task.id },
        data: { googleCalendarEventId: eventId, googleCalendarSynced: true },
      })
      return NextResponse.json({ task: serializeTask(updated) }, { status: 201 })
    } catch {
      // sync failed — still return task
    }
  }

  return NextResponse.json({ task: serialized }, { status: 201 })
}
