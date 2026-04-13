import type { Task } from '@/types'
import { format, parseISO, differenceInDays } from 'date-fns'

function formatTaskLine(task: Task): string {
  const priority = `[${task.priority}]`
  const est = task.estimatedMinutes ? ` (est. ${task.estimatedMinutes}min)` : ''
  const desc = task.description ? ` - ${task.description.slice(0, 80)}` : ''
  return `  • ${priority} ${task.title}${est}${desc}`
}

function formatOverdueLine(task: Task): string {
  const daysOverdue = task.dueDate
    ? differenceInDays(new Date(), parseISO(task.dueDate))
    : 0
  return `${formatTaskLine(task)} [${daysOverdue} day(s) overdue]`
}

export function buildDailyPlanPrompt(
  todayTasks: Task[],
  overdueTasks: Task[],
  date: string,
  currentTime: string
): { system: string; user: string } {
  const dayOfWeek = format(parseISO(date), 'EEEE')

  const system = `You are a personal productivity coach helping plan a focused, achievable workday.
You understand time management, cognitive load, and the importance of sustainable pace.
Always respond with ONLY valid JSON matching the exact schema provided. No markdown, no extra text.`

  const todayList =
    todayTasks.length > 0
      ? todayTasks.map(formatTaskLine).join('\n')
      : '  (none)'
  const overdueList =
    overdueTasks.length > 0
      ? overdueTasks.map(formatOverdueLine).join('\n')
      : '  (none)'

  const user = `Today is ${dayOfWeek}, ${date}. Current time: ${currentTime}.

TODAY'S TASKS (${todayTasks.length}):
${todayList}

OVERDUE TASKS (${overdueTasks.length}):
${overdueList}

Create a realistic daily schedule that:
1. Prioritizes urgent/overdue items
2. Groups similar tasks where possible
3. Includes buffer time between tasks
4. Doesn't over-schedule (max 6 focused hours / 360 min total)
5. Suggests which overdue tasks to defer if there are too many

Respond ONLY with JSON matching this exact schema:
{
  "date": "${date}",
  "introduction": "Brief encouraging intro (1-2 sentences)",
  "schedule": [
    {
      "taskId": "task id string",
      "title": "task title",
      "suggestedTimeSlot": "9:00 AM - 10:30 AM",
      "reasoning": "why this slot/order",
      "estimatedMinutes": 90
    }
  ],
  "totalEstimatedMinutes": 0,
  "tips": ["actionable tip 1", "actionable tip 2"]
}`

  return { system, user }
}

interface PriorityStats {
  created: number
  completed: number
}

export function buildFeedbackPrompt(metrics: {
  periodDays: number
  totalCreated: number
  totalCompleted: number
  totalCancelled: number
  overdueCount: number
  completionRate: number
  avgCompletionDays: number
  priorityBreakdown: Record<string, PriorityStats>
  completedTitles: string[]
  overdueTitles: string[]
}): { system: string; user: string } {
  const system = `You are an encouraging but honest productivity coach.
Give specific, actionable feedback based on real data.
Be concise and never preachy. Respond with ONLY valid JSON. No markdown, no extra text.`

  const breakdown = Object.entries(metrics.priorityBreakdown)
    .map(([p, s]) => `  ${p}: ${s.completed}/${s.created} completed`)
    .join('\n')

  const user = `Here is my task data for the last ${metrics.periodDays} days:

Completion rate: ${Math.round(metrics.completionRate * 100)}% (${metrics.totalCompleted}/${metrics.totalCreated} tasks)
Average days to complete: ${metrics.avgCompletionDays.toFixed(1)}
Overdue tasks: ${metrics.overdueCount}
Cancelled: ${metrics.totalCancelled}

Priority breakdown:
${breakdown}

Recently completed: ${metrics.completedTitles.slice(0, 10).join(', ') || 'none'}
Currently overdue: ${metrics.overdueTitles.slice(0, 5).join(', ') || 'none'}

Provide honest, specific productivity feedback. Respond ONLY with JSON:
{
  "period": "Last ${metrics.periodDays} days",
  "completionRate": ${Math.round(metrics.completionRate * 100)},
  "score": 7,
  "strengths": ["specific strength based on data"],
  "areasToImprove": ["specific area based on data"],
  "actionableAdvice": ["concrete next step 1", "concrete next step 2"],
  "motivationalMessage": "One genuine, non-generic encouraging sentence"
}`

  return { system, user }
}
