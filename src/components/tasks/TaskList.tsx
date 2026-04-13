'use client'

import { useEffect } from 'react'
import { useTaskStore } from '@/store/taskStore'
import { TaskCard } from './TaskCard'
import { ListTodo } from 'lucide-react'

export function TaskList() {
  const { tasks, loading, fetchTasks } = useTaskStore()

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-16 rounded-lg border bg-gray-50 dark:bg-gray-800 animate-pulse"
          />
        ))}
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <ListTodo className="h-12 w-12 mb-3 opacity-40" />
        <p className="text-sm font-medium">No tasks found</p>
        <p className="text-xs mt-1">Create a new task or adjust your filters</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} />
      ))}
    </div>
  )
}
