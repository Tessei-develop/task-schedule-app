'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useTaskStore } from '@/store/taskStore'
import { useUIStore } from '@/store/uiStore'
import { formatDueDate, isOverdue } from '@/lib/date-utils'
import { Pencil, Trash2, Check, CalendarDays, Tag, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Task } from '@/types'

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  MEDIUM: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  LOW: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

const STATUS_COLORS: Record<string, string> = {
  TODO: 'bg-gray-100 text-gray-600',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
  DONE: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-400 line-through',
}

export function TaskCard({ task }: { task: Task }) {
  const { updateTask, deleteTask } = useTaskStore()
  const openTaskForm = useUIStore((s) => s.openTaskForm)
  const [deleting, setDeleting] = useState(false)

  const overdue = isOverdue(task.dueDate, task.status)

  const toggleDone = async () => {
    const newStatus = task.status === 'DONE' ? 'TODO' : 'DONE'
    try {
      await updateTask(task.id, { status: newStatus })
    } catch {
      toast.error('Failed to update task')
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteTask(task.id)
      toast.success('Task deleted')
    } catch {
      toast.error('Failed to delete task')
      setDeleting(false)
    }
  }

  return (
    <div
      className={cn(
        'group flex items-start gap-3 p-3 rounded-lg border bg-white dark:bg-gray-900 hover:shadow-sm transition-shadow',
        task.status === 'DONE' && 'opacity-60',
        overdue && task.status !== 'DONE' && 'border-red-200 dark:border-red-800'
      )}
    >
      {/* Done toggle */}
      <button
        onClick={toggleDone}
        className={cn(
          'mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
          task.status === 'DONE'
            ? 'border-green-500 bg-green-500'
            : 'border-gray-300 hover:border-indigo-500'
        )}
      >
        {task.status === 'DONE' && <Check className="h-3 w-3 text-white" />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              'text-sm font-medium text-gray-900 dark:text-white truncate',
              task.status === 'DONE' && 'line-through text-gray-400'
            )}
          >
            {task.title}
          </p>
          <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => openTaskForm(task.id)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-red-400 hover:text-red-600"
              onClick={handleDelete}
              disabled={deleting}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {task.description && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{task.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          <Badge className={cn('text-xs px-1.5 py-0', PRIORITY_COLORS[task.priority])}>
            {task.priority}
          </Badge>
          <Badge className={cn('text-xs px-1.5 py-0', STATUS_COLORS[task.status])}>
            {task.status.replace('_', ' ')}
          </Badge>

          {task.dueDate && (
            <span
              className={cn(
                'flex items-center gap-1 text-xs',
                overdue ? 'text-red-500' : 'text-gray-400'
              )}
            >
              <CalendarDays className="h-3 w-3" />
              {formatDueDate(task.dueDate)}
              {overdue && ' (overdue)'}
            </span>
          )}

          {task.googleCalendarSynced && (
            <span className="flex items-center gap-1 text-xs text-blue-400">
              <Calendar className="h-3 w-3" />
            </span>
          )}

          {task.tags.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Tag className="h-3 w-3" />
              {task.tags.slice(0, 2).join(', ')}
              {task.tags.length > 2 && ` +${task.tags.length - 2}`}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
