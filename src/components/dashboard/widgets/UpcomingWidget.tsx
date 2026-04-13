'use client'

import { useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useTaskStore } from '@/store/taskStore'
import { useUIStore } from '@/store/uiStore'
import { isDueThisWeek, formatDueDate } from '@/lib/date-utils'
import { format, parseISO } from 'date-fns'
import { CalendarDays } from 'lucide-react'
import type { Task } from '@/types'

export function UpcomingWidget() {
  const { tasks, fetchTasks } = useTaskStore()
  const openTaskForm = useUIStore((s) => s.openTaskForm)

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const upcomingTasks: Task[] = tasks
    .filter((t) => isDueThisWeek(t.dueDate) && t.status !== 'DONE' && t.status !== 'CANCELLED')
    .sort((a, b) => {
      if (!a.dueDate || !b.dueDate) return 0
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    })

  // Group by day
  const grouped: Record<string, Task[]> = {}
  for (const task of upcomingTasks) {
    if (!task.dueDate) continue
    const day = task.dueDate.slice(0, 10)
    if (!grouped[day]) grouped[day] = []
    grouped[day].push(task)
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="h-4 w-4 text-indigo-500" />
          Upcoming (7 Days)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {Object.keys(grouped).length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No upcoming tasks this week</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(grouped).map(([day, dayTasks]) => (
              <div key={day}>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                  {format(parseISO(day), 'EEE, MMM d')}
                </p>
                <ul className="space-y-1">
                  {dayTasks.slice(0, 3).map((task) => (
                    <li key={task.id}>
                      <button
                        onClick={() => openTaskForm(task.id)}
                        className="text-left text-sm text-gray-700 dark:text-gray-300 hover:text-indigo-600 line-clamp-1 w-full"
                      >
                        {task.title}
                      </button>
                    </li>
                  ))}
                  {dayTasks.length > 3 && (
                    <li className="text-xs text-gray-400">+{dayTasks.length - 3} more</li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
