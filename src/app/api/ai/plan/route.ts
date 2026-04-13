import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { anthropic } from '@/lib/anthropic'
import { buildDailyPlanPrompt } from '@/lib/ai-prompts'
import { isOverdue, isDueToday, todayISO } from '@/lib/date-utils'
import { format } from 'date-fns'
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
    recurrence: t.recurrence as Task['recurrence'],
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const date = body.date ?? todayISO()
  const forceRefresh = body.forceRefresh ?? false

  // Check cache
  if (!forceRefresh) {
    const cached = await prisma.aIInsight.findFirst({
      where: { type: 'DAILY_PLAN', date },
    })
    if (cached) {
      return NextResponse.json({ plan: JSON.parse(cached.content), cached: true })
    }
  }

  const rawTasks = await prisma.task.findMany({
    where: { status: { notIn: ['DONE', 'CANCELLED'] } },
    orderBy: { dueDate: 'asc' },
  })

  const tasks = rawTasks.map(serializeTask)
  const todayTasks = tasks.filter((t: Task) => isDueToday(t.dueDate))
  const overdueTasks = tasks.filter((t: Task) => isOverdue(t.dueDate, t.status))
  const currentTime = format(new Date(), 'h:mm a')

  const { system, user } = buildDailyPlanPrompt(todayTasks, overdueTasks, date, currentTime)

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system,
    messages: [{ role: 'user', content: user }],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : '{}'
  let plan
  try {
    plan = JSON.parse(raw)
  } catch {
    plan = { date, introduction: raw, schedule: [], totalEstimatedMinutes: 0, tips: [] }
  }

  // Cache the result
  await prisma.aIInsight.deleteMany({ where: { type: 'DAILY_PLAN', date } })
  await prisma.aIInsight.create({
    data: { type: 'DAILY_PLAN', content: JSON.stringify(plan), date },
  })

  return NextResponse.json({ plan, cached: false })
}
