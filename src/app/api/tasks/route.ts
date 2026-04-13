import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isOverdue, isDueToday } from '@/lib/date-utils'
import { createCalendarEvent, isGoogleConnected } from '@/lib/google-calendar'
import type { Task } from '@/types'

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
  const status = searchParams.get('status')
  const priority = searchParams.get('priority')
  const search = searchParams.get('search')
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')
  const overdueOnly = searchParams.get('overdue') === 'true'
  const todayOnly = searchParams.get('dueToday') === 'true'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}
  if (status && status !== 'ALL') where.status = status
  if (priority && priority !== 'ALL') where.priority = priority
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
  if (overdueOnly) tasks = tasks.filter((t: Task) => isOverdue(t.dueDate, t.status))
  if (todayOnly) tasks = tasks.filter((t: Task) => isDueToday(t.dueDate))

  return NextResponse.json({ tasks, total: tasks.length })
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  const task = await prisma.task.create({
    data: {
      title: body.title,
      description: body.description ?? null,
      status: body.status ?? 'TODO',
      priority: body.priority ?? 'MEDIUM',
      startDate: body.startDate ? new Date(body.startDate) : null,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      estimatedMinutes: body.estimatedMinutes ?? null,
      startTime: body.startTime ?? null,
      endTime: body.endTime ?? null,
      tags: body.tags ?? [],
      recurrence: body.recurrence ?? null,
      recurrenceInterval: body.recurrenceInterval ?? null,
      recurrenceEndDate: body.recurrenceEndDate ? new Date(body.recurrenceEndDate) : null,
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
