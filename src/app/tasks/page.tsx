'use client'

import { Button } from '@/components/ui/button'
import { TaskFilters } from '@/components/tasks/TaskFilters'
import { TaskList } from '@/components/tasks/TaskList'
import { useUIStore } from '@/store/uiStore'
import { Plus } from 'lucide-react'

export default function TasksPage() {
  const openTaskForm = useUIStore((s) => s.openTaskForm)

  return (
    <div className="flex flex-col h-full">
      {/* Header + filters — never scrolls */}
      <div className="shrink-0 px-3 pt-3 pb-2 md:px-6 md:pt-6 md:pb-4 border-b border-border bg-background z-10">
        <div className="flex items-center justify-between mb-2 md:mb-4 max-w-4xl mx-auto">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Tasks</h1>
          <Button onClick={() => openTaskForm()} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            New Task
          </Button>
        </div>
        <div className="max-w-4xl mx-auto">
          <TaskFilters />
        </div>
      </div>

      {/* Scrollable task list */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 pt-2 pb-28 md:pb-6 md:px-6 md:pt-4 max-w-4xl mx-auto">
          <TaskList />
        </div>
      </div>
    </div>
  )
}
