import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { groq, GROQ_MODEL } from '@/lib/groq'
import { buildFeedbackPrompt } from '@/lib/ai-prompts'
import { isOverdue, todayISO } from '@/lib/date-utils'
import { subDays } from 'date-fns'
import type { Task } from '@/types'

function serializeTask(t: Awaited<ReturnType<typeof prisma.task.findFirst>>): Task {
  if (!t) throw new Error()
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
  const periodDays: number = body.periodDays ?? 7
  const forceRefresh = body.forceRefresh ?? false
  const cacheDate = todayISO()

  if (!forceRefresh) {
    const cached = await prisma.aIInsight.findFirst({
      where: { type: 'FEEDBACK', date: cacheDate },
    })
    if (cached) {
      return NextResponse.json({ feedback: JSON.parse(cached.content), cached: true })
    }
  }

  const since = subDays(new Date(), periodDays)

  const rawTasks = await prisma.task.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
  })

  const tasks = rawTasks.map(serializeTask)
  const completed = tasks.filter((t: Task) => t.status === 'DONE')
  const cancelled = tasks.filter((t: Task) => t.status === 'CANCELLED')
  const allTasks = await prisma.task.findMany()
  const overdueTasks = allTasks.map(serializeTask).filter((t: Task) => isOverdue(t.dueDate, t.status, t.endTime))

  // Compute avg completion days
  const completionDays = completed
    .filter((t: Task) => t.completedAt && t.createdAt)
    .map((t: Task) => {
      const created = new Date(t.createdAt).getTime()
      const done = new Date(t.completedAt!).getTime()
      return (done - created) / (1000 * 60 * 60 * 24)
    })
  const avgCompletionDays =
    completionDays.length > 0
      ? completionDays.reduce((a: number, b: number) => a + b, 0) / completionDays.length
      : 0

  const priorityBreakdown: Record<string, { created: number; completed: number }> = {}
  for (const p of ['URGENT', 'HIGH', 'MEDIUM', 'LOW']) {
    priorityBreakdown[p] = {
      created: tasks.filter((t: Task) => t.priority === p).length,
      completed: completed.filter((t: Task) => t.priority === p).length,
    }
  }

  const metrics = {
    periodDays,
    totalCreated: tasks.length,
    totalCompleted: completed.length,
    totalCancelled: cancelled.length,
    overdueCount: overdueTasks.length,
    completionRate: tasks.length > 0 ? completed.length / tasks.length : 0,
    avgCompletionDays,
    priorityBreakdown,
    completedTitles: completed.map((t: Task) => t.title),
    overdueTitles: overdueTasks.map((t: Task) => t.title),
  }

  const { system, user } = buildFeedbackPrompt(metrics)

  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    max_tokens: 1024,
    temperature: 0.3,
  })
  const raw = completion.choices[0]?.message?.content ?? '{}'
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  let feedback
  try {
    feedback = JSON.parse(cleaned)
  } catch {
    feedback = {
      period: `Last ${periodDays} days`,
      completionRate: Math.round(metrics.completionRate * 100),
      score: 5,
      strengths: [],
      areasToImprove: [],
      actionableAdvice: [raw],
      motivationalMessage: '',
    }
  }

  await prisma.aIInsight.deleteMany({ where: { type: 'FEEDBACK', date: cacheDate } })
  await prisma.aIInsight.create({
    data: { type: 'FEEDBACK', content: JSON.stringify(feedback), date: cacheDate },
  })

  return NextResponse.json({ feedback, cached: false })
}
