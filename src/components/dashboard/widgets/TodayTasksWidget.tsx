'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useTaskStore } from '@/store/taskStore'
import { useUIStore } from '@/store/uiStore'
import { isDueToday } from '@/lib/date-utils'
import { CheckCircle2, Circle, Sun } from 'lucide-react'
import { toast } from 'sonner'
import type { Task } from '@/types'

export function TodayTasksWidget() {
  const { tasks, fetchTasks, updateTask } = useTaskStore()
  const openTaskForm = useUIStore((s) => s.openTaskForm)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTasks().finally(() => setLoading(false))
  }, [fetchTasks])

  const todayTasks: Task[] = tasks.filter((t) => isDueToday(t.dueDate))
  const doneTasks = todayTasks.filter((t) => t.status === 'DONE')
  const progress = todayTasks.length > 0 ? doneTasks.length / todayTasks.length : 0

  const toggleDone = async (task: Task) => {
    try {
      await updateTask(task.id, {
        status: task.status === 'DONE' ? 'TODO' : 'DONE',
      })
    } catch {
      toast.error('Failed to update task')
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sun className="h-4 w-4 text-yellow-500" />
          Today&apos;s Tasks
          <span className="ml-auto text-xs text-gray-400">
            {doneTasks.length}/{todayTasks.length} done
          </span>
        </CardTitle>
        {todayTasks.length > 0 && (
          <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
            <div
              className="bg-green-500 h-1.5 rounded-full transition-all"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-8 rounded bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : todayTasks.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No tasks due today</p>
        ) : (
          <ul className="space-y-1">
            {todayTasks.map((task) => (
              <li key={task.id} className="flex items-center gap-2">
                <button onClick={() => toggleDone(task)} className="flex-shrink-0">
                  {task.status === 'DONE' ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <Circle className="h-5 w-5 text-gray-300 hover:text-indigo-500 transition-colors" />
                  )}
                </button>
                <button
                  onClick={() => openTaskForm(task.id)}
                  className={`flex-1 text-left text-sm ${
                    task.status === 'DONE'
                      ? 'line-through text-gray-400'
                      : 'text-gray-800 dark:text-gray-200 hover:text-indigo-600'
                  }`}
                >
                  {task.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
