import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  updateCalendarEvent,
  deleteCalendarEvent,
  createCalendarEvent,
  isGoogleConnected,
} from '@/lib/google-calendar'
import { addDays, addWeeks, addMonths, addYears, parseISO, isBefore } from 'date-fns'
import type { Task, RecurrenceType } from '@/types'

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

function nextRecurrenceDate(from: Date, type: RecurrenceType, interval: number): Date {
  const n = interval || 1
  switch (type) {
    case 'DAILY':   return addDays(from, n)
    case 'WEEKLY':  return addWeeks(from, n)
    case 'MONTHLY': return addMonths(from, n)
    case 'YEARLY':  return addYears(from, n)
  }
}

async function spawnNextRecurrence(task: Awaited<ReturnType<typeof prisma.task.findFirst>>) {
  if (!task || !task.recurrence || !task.dueDate) return

  const nextDue = nextRecurrenceDate(
    task.dueDate,
    task.recurrence as RecurrenceType,
    task.recurrenceInterval || 1
  )

  // Stop if past recurrence end date
  if (task.recurrenceEndDate && isBefore(task.recurrenceEndDate, nextDue)) return

  const nextStart = task.startDate
    ? nextRecurrenceDate(task.startDate, task.recurrence as RecurrenceType, task.recurrenceInterval || 1)
    : null

  const next = await prisma.task.create({
    data: {
      title: task.title,
      description: task.description,
      status: 'TODO',
      priority: task.priority,
      startDate: nextStart,
      dueDate: nextDue,
      estimatedMinutes: task.estimatedMinutes,
      startTime: task.startTime,
      endTime: task.endTime,
      tags: task.tags,
      recurrence: task.recurrence,
      recurrenceInterval: task.recurrenceInterval,
      recurrenceEndDate: task.recurrenceEndDate,
    },
  })

  const serialized = serializeTask(next)
  if (await isGoogleConnected()) {
    try {
      const eventId = await createCalendarEvent(serialized)
      await prisma.task.update({
        where: { id: next.id },
        data: { googleCalendarEventId: eventId, googleCalendarSynced: true },
      })
    } catch { /* non-fatal */ }
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const task = await prisma.task.findUnique({ where: { id } })
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ task: serializeTask(task) })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()

  const updateData: Record<string, unknown> = {}
  if (body.title !== undefined) updateData.title = body.title
  if (body.description !== undefined) updateData.description = body.description
  if (body.status !== undefined) {
    updateData.status = body.status
    updateData.completedAt = body.status === 'DONE' ? new Date() : null
  }
  if (body.priority !== undefined) updateData.priority = body.priority
  if ('startDate' in body) updateData.startDate = body.startDate ? new Date(body.startDate) : null
  if ('dueDate' in body) updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null
  if (body.estimatedMinutes !== undefined) updateData.estimatedMinutes = body.estimatedMinutes
  if ('startTime' in body) updateData.startTime = body.startTime ?? null
  if ('endTime' in body) updateData.endTime = body.endTime ?? null
  if (body.tags !== undefined) updateData.tags = body.tags
  if ('recurrence' in body) updateData.recurrence = body.recurrence ?? null
  if ('recurrenceInterval' in body) updateData.recurrenceInterval = body.recurrenceInterval ?? null
  if ('recurrenceEndDate' in body)
    updateData.recurrenceEndDate = body.recurrenceEndDate ? new Date(body.recurrenceEndDate) : null

  const task = await prisma.task.update({ where: { id }, data: updateData })
  const serialized = serializeTask(task)

  // Spawn next occurrence when marked DONE
  if (body.status === 'DONE') {
    await spawnNextRecurrence(task)
  }

  if (task.googleCalendarSynced && await isGoogleConnected()) {
    try {
      await updateCalendarEvent(serialized)
    } catch {
      await prisma.task.update({ where: { id }, data: { googleCalendarSynced: false } })
    }
  }

  return NextResponse.json({ task: serialized })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const task = await prisma.task.findUnique({ where: { id } })
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (task.googleCalendarEventId && await isGoogleConnected()) {
    try { await deleteCalendarEvent(task.googleCalendarEventId) } catch { /* non-fatal */ }
  }

  await prisma.task.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
