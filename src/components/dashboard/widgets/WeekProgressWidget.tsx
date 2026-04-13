'use client'

import { useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useTaskStore } from '@/store/taskStore'
import { startOfWeek, addDays, format, isSameDay, parseISO, isToday } from 'date-fns'
import { BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function WeekProgressWidget() {
  const { tasks, fetchTasks } = useTaskStore()

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }) // Monday
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4 text-indigo-500" />
          This Week
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between gap-1">
          {days.map((day) => {
            const dueTasks = tasks.filter(
              (t) => t.dueDate && isSameDay(parseISO(t.dueDate), day)
            )
            const doneTasks = dueTasks.filter((t) => t.status === 'DONE')
            const total = dueTasks.length
            const done = doneTasks.length
            const isCurrentDay = isToday(day)
            const isWeekend = day.getDay() === 0 || day.getDay() === 6

            return (
              <div key={day.toISOString()} className="flex flex-col items-center gap-1 flex-1">
                <div className="w-full flex flex-col gap-0.5" style={{ height: '40px' }}>
                  {total > 0 ? (
                    <>
                      <div
                        className="w-full bg-green-400 dark:bg-green-600 rounded-t-sm"
                        style={{ height: `${(done / Math.max(total, 1)) * 40}px`, minHeight: done > 0 ? '4px' : '0' }}
                      />
                      <div
                        className={cn(
                          'w-full rounded-b-sm',
                          isCurrentDay ? 'bg-indigo-200 dark:bg-indigo-800' : 'bg-gray-200 dark:bg-gray-700'
                        )}
                        style={{ height: `${((total - done) / Math.max(total, 1)) * 40}px`, minHeight: total - done > 0 ? '4px' : '0' }}
                      />
                    </>
                  ) : (
                    <div className="w-full h-full" />
                  )}
                </div>
                <span
                  className={cn(
                    'text-xs font-medium',
                    isCurrentDay
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : isWeekend
                      ? 'text-gray-300 dark:text-gray-600'
                      : 'text-gray-500 dark:text-gray-400'
                  )}
                >
                  {format(day, 'EEE').slice(0, 2)}
                </span>
                {total > 0 && (
                  <span className="text-xs text-gray-400">{done}/{total}</span>
                )}
              </div>
            )
          })}
        </div>
        <div className="flex items-center gap-3 mt-2">
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-green-400 dark:bg-green-600" />
            Done
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-gray-200 dark:bg-gray-700" />
            Remaining
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
