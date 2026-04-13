'use client'

import { useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useTaskStore } from '@/store/taskStore'
import { TrendingUp } from 'lucide-react'
import { subDays, isAfter } from 'date-fns'

export function CompletionRateWidget() {
  const { tasks, fetchTasks } = useTaskStore()

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const since30 = subDays(new Date(), 30)
  const recentTasks = tasks.filter((t) => isAfter(new Date(t.createdAt), since30))
  const recentDone = recentTasks.filter((t) => t.status === 'DONE')
  const rate = recentTasks.length > 0 ? Math.round((recentDone.length / recentTasks.length) * 100) : 0

  // Week-by-week data for mini chart (last 4 weeks)
  const weekData = [3, 2, 1, 0].map((weeksAgo) => {
    const weekStart = subDays(new Date(), (weeksAgo + 1) * 7)
    const weekEnd = subDays(new Date(), weeksAgo * 7)
    const created = tasks.filter(
      (t) => isAfter(new Date(t.createdAt), weekStart) && !isAfter(new Date(t.createdAt), weekEnd)
    )
    const done = created.filter((t) => t.status === 'DONE')
    return created.length > 0 ? Math.round((done.length / created.length) * 100) : 0
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
