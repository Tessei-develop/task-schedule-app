import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getGroq, GROQ_MODEL } from '@/lib/groq'
import { buildDailyPlanPrompt } from '@/lib/ai-prompts'
import { isOverdue, isDueToday, todayISO } from '@/lib/date-utils'
import { checkRateLimit } from '@/lib/rate-limit'
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
  // Rate limit: 20 requests per hour per IP to protect Groq quota
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const limit = checkRateLimit(`ai-plan:${ip}`, 20, 60 * 60 * 1000)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before generating another plan.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(limit.resetInMs / 1000)) } }
    )
  }

  try {
    let body: Record<string, unknown> = {}
    try { body = await req.json() } catch { /* body is optional */ }

    const date = typeof body.date === 'string' ? body.date : todayISO()
    const forceRefresh = body.forceRefresh === true

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
    const overdueTasks = tasks.filter((t: Task) => isOverdue(t.dueDate, t.status, t.endTime))
    const currentTime = format(new Date(), 'h:mm a')

    const { system, user } = buildDailyPlanPrompt(todayTasks, overdueTasks, date, currentTime)

    const completion = await getGroq().chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: 2048,
      temperature: 0.3,
    })

    // Guard against empty/malformed Groq response
    if (!completion.choices?.length || !completion.choices[0]?.message?.content) {
      throw new Error('AI model returned an empty response')
    }

    const raw = completion.choices[0].message.content
    // Strip markdown code fences that some models add
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()

    let plan
    try {
      plan = JSON.parse(cleaned)
    } catch {
      // Fallback: wrap raw text so the widget still renders something useful
      plan = { date, introduction: raw, schedule: [], totalEstimatedMinutes: 0, tips: [] }
    }

    // Cache the result
    await prisma.aIInsight.deleteMany({ where: { type: 'DAILY_PLAN', date } })
    await prisma.aIInsight.create({
      data: { type: 'DAILY_PLAN', content: JSON.stringify(plan), date },
    })

    return NextResponse.json({ plan, cached: false })
  } catch (err) {
    console.error('[POST /api/ai/plan]', err)
    return NextResponse.json({ error: 'Failed to generate daily plan' }, { status: 500 })
  }
}
