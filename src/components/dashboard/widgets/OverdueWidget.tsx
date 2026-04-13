'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useTaskStore } from '@/store/taskStore'
import { useUIStore } from '@/store/uiStore'
import { formatRelativeDate, isOverdue } from '@/lib/date-utils'
import { AlertCircle, Check } from 'lucide-react'
import { toast } from 'sonner'
import type { Task } from '@/types'

export function OverdueWidget() {
  const { tasks, fetchTasks, updateTask } = useTaskStore()
  const openTaskForm = useUIStore((s) => s.openTaskForm)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTasks().finally(() => setLoading(false))
  }, [fetchTasks])

  const overdueTasks: Task[] = tasks
    .filter((t) => isOverdue(t.dueDate, t.status))
    .sort((a, b) => {
      if (!a.dueDate || !b.dueDate) return 0
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    })

  const markDone = async (id: string) => {
    try {
      await updateTask(id, { status: 'DONE' })
      toast.success('Marked as done')
    } catch {
      toast.error('Failed to update task')
    }
  }

  return (
    <Card className="border-red-200 dark:border-red-900">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400 text-base">
          <AlertCircle className="h-4 w-4" />
          Overdue Tasks
          {overdueTasks.length > 0 && (
            <span className="ml-auto bg-red-100 text-red-600 dark:bg-red-900/40 text-xs font-bold px-2 py-0.5 rounded-full">
              {overdueTasks.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-10 rounded bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : overdueTasks.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No overdue tasks!</p>
        ) : (
          <ul className="space-y-2">
            {overdueTasks.map((task) => (
              <li
                key={task.id}
                className="flex items-center gap-2 group"
              >
                <button
                  onClick={() => markDone(task.id)}
                  className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-red-300 hover:border-green-500 hover:bg-green-50 flex items-center justify-center transition-colors"
                >
                  <Check className="h-3 w-3 text-green-500 opacity-0 group-hover:opacity-100" />
                </button>
                <button
                  onClick={() => openTaskForm(task.id)}
                  className="flex-1 text-left"
                >
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200 hover:text-indigo-600 line-clamp-1">
                    {task.title}
                  </span>
                  <span className="text-xs text-red-500 block">
                    {formatRelativeDate(task.dueDate)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
