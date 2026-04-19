'use client'

import { Button } from '@/components/ui/button'
import { TaskFilters } from '@/components/tasks/TaskFilters'
import { TaskList } from '@/components/tasks/TaskList'
import { useUIStore } from '@/store/uiStore'
import { Plus } from 'lucide-react'

export default function TasksPage() {
  const openTaskForm = useUIStore((s) => s.openTaskForm)

  return (
    <div className="p-3 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-2 md:mb-4">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Tasks</h1>
        <Button onClick={() => openTaskForm()} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          New Task
        </Button>
      </div>

      <div className="mb-2 md:mb-4">
        <TaskFilters />
      </div>

      <TaskList />
    </div>
  )
}
