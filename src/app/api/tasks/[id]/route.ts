import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import {
  updateCalendarEvent,
  deleteCalendarEvent,
  createCalendarEvent,
  isGoogleConnected,
} from '@/lib/google-calendar'
import { addDays, addWeeks, addMonths, addYears, parseISO, isBefore } from 'date-fns'
import type { Task, RecurrenceType } from '@/types'

const TIME_RE = /^\d{2}:\d{2}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const PatchSchema = z.object({
  title:              z.string().min(1).max(255).optional(),
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

  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', issues: parsed.error.issues }, { status: 400 })
  }
  const data = parsed.data

  const updateData: Record<string, unknown> = {}
  if (data.title !== undefined) updateData.title = data.title
  if (data.description !== undefined) updateData.description = data.description
  if (data.status !== undefined) {
    updateData.status = data.status
    updateData.completedAt = data.status === 'DONE' ? new Date() : null
  }
  if (data.priority !== undefined) updateData.priority = data.priority
  if ('startDate' in data) updateData.startDate = data.startDate ? new Date(data.startDate) : null
  if ('dueDate' in data) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null
  if (data.estimatedMinutes !== undefined) updateData.estimatedMinutes = data.estimatedMinutes
  if ('startTime' in data) updateData.startTime = data.startTime ?? null
  if ('endTime' in data) updateData.endTime = data.endTime ?? null
  if (data.tags !== undefined) updateData.tags = data.tags
  if ('recurrence' in data) updateData.recurrence = data.recurrence ?? null
  if ('recurrenceInterval' in data) updateData.recurrenceInterval = data.recurrenceInterval ?? null
  if ('recurrenceEndDate' in data)
    updateData.recurrenceEndDate = data.recurrenceEndDate ? new Date(data.recurrenceEndDate) : null

  const task = await prisma.task.update({ where: { id }, data: updateData })
  const serialized = serializeTask(task)

  // Spawn next occurrence when marked DONE
  if (body.status === 'DONE') {
    await spawnNextRecurrence(task)
  }

  // Push update to Google Calendar if an event ID exists — regardless of synced flag
  if (task.googleCalendarEventId && await isGoogleConnected()) {
    try {
      await updateCalendarEvent(serialized)
      // Re-mark as synced in case it was previously unset due to an error
      if (!task.googleCalendarSynced) {
        await prisma.task.update({ where: { id }, data: { googleCalendarSynced: true } })
      }
    } catch (err) {
      console.error('[Google Calendar update error]', err)
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
