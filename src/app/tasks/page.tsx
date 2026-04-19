'use client'

import { Button } from '@/components/ui/button'
import { TaskFilters } from '@/components/tasks/TaskFilters'
import { TaskList } from '@/components/tasks/TaskList'
import { useUIStore } from '@/store/uiStore'
import { Plus } from 'lucide-react'

export default function TasksPage() {
  const openTaskForm = useUIStore((s) => s.openTaskForm)

  return (
    <div className="max-w-4xl mx-auto">
      {/* Sticky filter bar on mobile; normal flow on desktop */}
      <div className="sticky top-0 z-30 bg-background md:static md:bg-transparent px-3 pt-3 pb-2 md:px-6 md:pt-6 md:pb-0 border-b border-border md:border-none shadow-sm md:shadow-none">
        <div className="flex items-center justify-between mb-2 md:mb-4">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Tasks</h1>
          <Button onClick={() => openTaskForm()} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            New Task
          </Button>
        </div>
        <TaskFilters />
      </div>

      <div className="px-3 pt-2 pb-3 md:px-6 md:pt-4 md:pb-6">
        <TaskList />
      </div>
    </div>
  )
}
