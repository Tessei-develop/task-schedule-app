'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useTaskStore } from '@/store/taskStore'
import { useUIStore } from '@/store/uiStore'
import { formatDueDate, isOverdue } from '@/lib/date-utils'
import { Check, CalendarDays, Calendar, RefreshCw, Clock, ChevronDown, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Task, TaskStatus } from '@/types'

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  HIGH:   'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  MEDIUM: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  LOW:    'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

const STATUS_COLORS: Record<string, string> = {
  TODO:        'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  DONE:        'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  CANCELLED:   'bg-gray-100 text-gray-400 line-through dark:bg-gray-800',
}

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'TODO',        label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'DONE',        label: 'Done' },
  { value: 'CANCELLED',   label: 'Cancelled' },
]

const TAG_COLORS: Record<string, string> = {
  work:     'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  personal: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  family:   'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  study:    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  others:   'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

const RECURRENCE_LABELS: Record<string, string> = {
  DAILY:   '↻ Daily',
  WEEKLY:  '↻ Weekly',
  MONTHLY: '↻ Monthly',
  YEARLY:  '↻ Yearly',
  WEEKDAY: '↻ Weekdays',
  WEEKEND: '↻ Weekends',
}

function formatTime(t: string | null | undefined): string | null {
  if (!t) return null
  // Validate "HH:MM" before parsing to avoid bad output on corrupt data
  const match = t.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const h = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  if (h < 0 || h > 23 || m < 0 || m > 59) return null
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

/** Swallow clicks/keys so interacting with an inline editor never opens the
 *  full task form (the whole card is a button). */
const stop = (e: React.SyntheticEvent) => e.stopPropagation()

export function TaskCard({ task }: { task: Task }) {
  const { updateTask } = useTaskStore()
  const openTaskForm = useUIStore((s) => s.openTaskForm)

  const overdue = isOverdue(task.dueDate, task.status, task.endTime)

  const toggleDone = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const newStatus = task.status === 'DONE' ? 'TODO' : 'DONE'
    try {
      await updateTask(task.id, { status: newStatus })
    } catch {
      toast.error('Failed to update task')
    }
  }

  const startFormatted = formatTime(task.startTime)
  const endFormatted   = formatTime(task.endTime)
  const timeLabel = startFormatted
    ? endFormatted
      ? `${startFormatted} – ${endFormatted}`
      : startFormatted
    : null

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => openTaskForm(task.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          openTaskForm(task.id)
        }
      }}
      className={cn(
        'group flex items-start gap-3 p-3 rounded-lg border bg-white dark:bg-gray-900 transition-shadow cursor-pointer',
        'hover:shadow-sm hover:border-indigo-300 dark:hover:border-indigo-700',
        'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1',
        task.status === 'DONE' && 'opacity-60',
        overdue && task.status !== 'DONE' && 'border-red-200 dark:border-red-800'
      )}
    >
      {/* Done toggle — stops propagation so tapping it doesn't open the form */}
      <button
        type="button"
        onClick={toggleDone}
        aria-label={task.status === 'DONE' ? 'Mark as not done' : 'Mark as done'}
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
        <p className={cn(
          'text-sm font-medium text-gray-900 dark:text-white truncate',
          task.status === 'DONE' && 'line-through text-gray-400'
        )}>
          {task.title}
        </p>

        {task.description && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{task.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          <Badge className={cn('text-xs px-1.5 py-0', PRIORITY_COLORS[task.priority])}>
            {task.priority}
          </Badge>

          {/* Inline status editor */}
          <StatusEditor task={task} updateTask={updateTask} />

          {/* Inline date editor */}
          <DateEditor task={task} updateTask={updateTask} overdue={overdue} />

          {/* Inline time editor */}
          <TimeEditor task={task} updateTask={updateTask} timeLabel={timeLabel} />

          {task.recurrence && (
            <span className="flex items-center gap-1 text-xs text-indigo-500 font-medium">
              <RefreshCw className="h-3 w-3" />
              {RECURRENCE_LABELS[task.recurrence]}
              {task.recurrenceInterval && task.recurrenceInterval > 1
                ? ` ×${task.recurrenceInterval}`
                : ''}
            </span>
          )}

          {task.googleCalendarSynced && (
            <span className="flex items-center gap-1 text-xs text-blue-400">
              <Calendar className="h-3 w-3" />
            </span>
          )}

          {/* Tags */}
          {task.tags.map((tag) => (
            <Badge
              key={tag}
              className={cn(
                'text-xs px-1.5 py-0 capitalize',
                TAG_COLORS[tag] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
              )}
            >
              {tag}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Inline editors ────────────────────────────────────────────────────────────

type UpdateFn = (id: string, data: Partial<Task>, opts?: { scope?: 'task' | 'series' }) => Promise<Task>

function StatusEditor({ task, updateTask }: { task: Task; updateTask: UpdateFn }) {
  const [open, setOpen] = useState(false)

  const pick = async (value: TaskStatus) => {
    setOpen(false)
    if (value === task.status) return
    try {
      await updateTask(task.id, { status: value })
    } catch {
      toast.error('Failed to update status')
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        onClick={stop}
        className={cn(
          'inline-flex items-center gap-0.5 rounded px-1.5 py-0 text-xs font-medium hover:ring-1 hover:ring-indigo-300 transition',
          STATUS_COLORS[task.status],
        )}
      >
        {task.status.replace('_', ' ')}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        onClick={stop}
        className="w-40 p-1"
      >
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => pick(opt.value)}
            className={cn(
              'flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-left hover:bg-accent',
              opt.value === task.status && 'font-semibold',
            )}
          >
            <span className={cn('h-2 w-2 rounded-full', STATUS_COLORS[opt.value].split(' ')[0])} />
            {opt.label}
            {opt.value === task.status && <Check className="h-3.5 w-3.5 ml-auto text-indigo-500" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

function DateEditor({ task, updateTask, overdue }: { task: Task; updateTask: UpdateFn; overdue: boolean }) {
  const [open, setOpen] = useState(false)
  const current = task.dueDate ? task.dueDate.slice(0, 10) : ''
  const [val, setVal] = useState(current)

  // Keep local state in sync if the task changes underneath us
  if (!open && val !== current) setVal(current)

  const commit = async (next: string) => {
    if (next === current) return
    try {
      await updateTask(task.id, { dueDate: next || null })
    } catch {
      toast.error('Failed to update date')
      setVal(current)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        onClick={stop}
        className={cn(
          'inline-flex items-center gap-1 rounded px-1.5 py-0 text-xs hover:ring-1 hover:ring-indigo-300 transition',
          task.dueDate
            ? overdue ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'
            : 'text-gray-400',
        )}
      >
        <CalendarDays className="h-3 w-3" />
        {task.dueDate ? (
          <>
            {formatDueDate(task.dueDate)}
            {overdue && ' (overdue)'}
          </>
        ) : (
          'Set date'
        )}
      </PopoverTrigger>
      <PopoverContent align="start" onClick={stop} className="w-auto p-2 space-y-2">
        <input
          type="date"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={stop}
          className="rounded-md border border-input bg-background px-2 py-1 text-sm"
        />
        <div className="flex items-center justify-between gap-2">
          {task.dueDate && (
            <button
              type="button"
              onClick={() => { setVal(''); commit(''); setOpen(false) }}
              className="text-xs text-gray-500 hover:text-red-600"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={() => { commit(val); setOpen(false) }}
            className="ml-auto rounded bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700"
          >
            Save
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function TimeEditor({ task, updateTask, timeLabel }: { task: Task; updateTask: UpdateFn; timeLabel: string | null }) {
  const [open, setOpen] = useState(false)
  const [start, setStart] = useState(task.startTime ?? '')
  const [end, setEnd] = useState(task.endTime ?? '')

  // Sync when the task changes and the popover is closed
  if (!open) {
    if (start !== (task.startTime ?? '')) setStart(task.startTime ?? '')
    if (end !== (task.endTime ?? '')) setEnd(task.endTime ?? '')
  }

  const commit = async () => {
    const nextStart = start || null
    const nextEnd = end || null
    if (nextStart === (task.startTime ?? null) && nextEnd === (task.endTime ?? null)) return
    try {
      await updateTask(task.id, { startTime: nextStart, endTime: nextEnd })
    } catch {
      toast.error('Failed to update time')
      setStart(task.startTime ?? '')
      setEnd(task.endTime ?? '')
    }
  }

  const clear = async () => {
    setStart(''); setEnd(''); setOpen(false)
    try {
      await updateTask(task.id, { startTime: null, endTime: null })
    } catch {
      toast.error('Failed to update time')
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        onClick={stop}
        className={cn(
          'inline-flex items-center gap-1 rounded px-1.5 py-0 text-xs hover:ring-1 hover:ring-indigo-300 transition',
          timeLabel ? 'text-gray-500 dark:text-gray-400' : 'text-gray-400',
        )}
      >
        {timeLabel ? <Clock className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
        {timeLabel ?? 'Add time'}
      </PopoverTrigger>
      <PopoverContent align="start" onClick={stop} className="w-auto p-2 space-y-2">
        <div className="flex items-center gap-2">
          <label className="flex flex-col text-[10px] font-medium text-gray-500">
            Start
            <input
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              onKeyDown={stop}
              className="rounded-md border border-input bg-background px-2 py-1 text-sm"
            />
          </label>
          <label className="flex flex-col text-[10px] font-medium text-gray-500">
            End
            <input
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              onKeyDown={stop}
              className="rounded-md border border-input bg-background px-2 py-1 text-sm"
            />
          </label>
        </div>
        <div className="flex items-center justify-between gap-2">
          {(task.startTime || task.endTime) && (
            <button
              type="button"
              onClick={clear}
              className="text-xs text-gray-500 hover:text-red-600"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={() => { commit(); setOpen(false) }}
            className="ml-auto rounded bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700"
          >
            Save
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
