import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  updateCalendarEvent,
  deleteCalendarEvent,
  isGoogleConnected,
} from '@/lib/google-calendar'
import type { Task } from '@/types'

function serializeTask(t: Awaited<ReturnType<typeof prisma.task.findFirst>>): Task {
  if (!t) throw new Error('Task not found')
  return {
    ...t,
    startDate: t.startDate?.toISOString() ?? null,
    dueDate: t.dueDate?.toISOString() ?? null,
    completedAt: t.completedAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    status: t.status as Task['status'],
    priority: t.priority as Task['priority'],
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
    updateData.completedAt =
      body.status === 'DONE' ? new Date() : null
  }
  if (body.priority !== undefined) updateData.priority = body.priority
  if ('startDate' in body) updateData.startDate = body.startDate ? new Date(body.startDate) : null
  if ('dueDate' in body) updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null
  if (body.estimatedMinutes !== undefined) updateData.estimatedMinutes = body.estimatedMinutes
  if (body.tags !== undefined) updateData.tags = body.tags

  const task = await prisma.task.update({ where: { id }, data: updateData })
  const serialized = serializeTask(task)

  // Sync update to Google Calendar
  if (task.googleCalendarSynced && await isGoogleConnected()) {
    try {
      await updateCalendarEvent(serialized)
    } catch {
      await prisma.task.update({
        where: { id },
        data: { googleCalendarSynced: false },
      })
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
    try {
      await deleteCalendarEvent(task.googleCalendarEventId)
    } catch {
      // Continue even if Google sync fails
    }
  }

  await prisma.task.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
