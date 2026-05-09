'use client'

import { useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useTaskStore } from '@/store/taskStore'
import { TrendingUp } from 'lucide-react'
import { subDays, isAfter } from 'date-fns'

export function CompletionRateWidget() {
  const { allTasks, fetchAllTasks } = useTaskStore()

  useEffect(() => {
    fetchAllTasks()
  }, [fetchAllTasks])

  const tasks = allTasks
  const now = new Date()
  const since30 = subDays(now, 30)

  // "Past 30 days" means tasks DUE within the last 30 days (today inclusive).
  // Using dueDate (not createdAt) so a task created weeks ago and due last
  // week counts toward this period — that's what "completion rate for the
  // past 30 days" intuitively means.
  const dueInWindow = (t: { dueDate: string | null }, from: Date, to: Date) => {
    if (!t.dueDate) return false
    const d = new Date(t.dueDate)
    return isAfter(d, from) && !isAfter(d, to)
  }

  const recentTasks = tasks.filter((t) => dueInWindow(t, since30, now))
  const recentDone = recentTasks.filter((t) => t.status === 'DONE')
  const rate = recentTasks.length > 0 ? Math.round((recentDone.length / recentTasks.length) * 100) : 0

  // Week-by-week data for mini chart (last 4 weeks, by dueDate)
  const weekData = [3, 2, 1, 0].map((weeksAgo) => {
    const weekStart = subDays(now, (weeksAgo + 1) * 7)
    const weekEnd = subDays(now, weeksAgo * 7)
    const dueThisWeek = tasks.filter((t) => dueInWindow(t, weekStart, weekEnd))
    const done = dueThisWeek.filter((t) => t.status === 'DONE')
    return dueThisWeek.length > 0 ? Math.round((done.length / dueThisWeek.length) * 100) : 0
  })

  const maxVal = Math.max(...weekData, 1)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4 text-green-500" />
          30-Day Completion Rate
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-4">
          <div>
            <p className="text-4xl font-bold text-gray-900 dark:text-white">{rate}%</p>
            <p className="text-xs text-gray-400 mt-1">
              {recentDone.length}/{recentTasks.length} tasks done
            </p>
          </div>
          {/* Mini sparkline */}
          <div className="flex items-end gap-1 h-12 ml-auto">
            {weekData.map((val, i) => (
              <div
                key={i}
                className="w-5 bg-green-400 dark:bg-green-600 rounded-sm transition-all"
                style={{ height: `${(val / maxVal) * 100}%`, minHeight: '4px' }}
                title={`Week ${i + 1}: ${val}%`}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
