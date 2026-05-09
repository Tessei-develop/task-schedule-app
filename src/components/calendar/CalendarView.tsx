'use client'

import { useEffect, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventClickArg, EventDropArg, DateSelectArg } from '@fullcalendar/core'
import type { DateClickArg } from '@fullcalendar/interaction'
import { useTaskStore } from '@/store/taskStore'
import { useUIStore } from '@/store/uiStore'
import { toast } from 'sonner'
import type { Task } from '@/types'

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#6366f1',
  LOW: '#9ca3af',
}

/** Extract "YYYY-MM-DD" from an ISO string without any timezone conversion. */
function isoToDateStr(iso: string): string {
  return iso.slice(0, 10)
}

/** Convert a JS Date to a local "YYYY-MM-DD" string (no UTC conversion). */
function dateToLocalStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * FullCalendar all-day end dates are *exclusive* (the event displays through
 * the day before end). Add 1 day so the task's actual due date is included.
 */
function exclusiveEndDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + 1)
  return dateToLocalStr(d)
}

function taskToEvent(task: Task) {
  const dateStr = isoToDateStr(task.dueDate ?? task.startDate ?? new Date().toISOString())

  // Build FullCalendar start/end as *local* datetime strings (no "Z" / offset
  // suffix) so the browser never shifts them by the timezone offset.
  let start: string
  let end: string
  let allDay: boolean

  if (task.startTime) {
    allDay = false
    start = `${isoToDateStr(task.startDate ?? task.dueDate ?? new Date().toISOString())}T${task.startTime}:00`
    end   = task.endTime
      ? `${dateStr}T${task.endTime}:00`
      : `${dateStr}T${task.startTime}:00`
  } else {
    // All-day: pass date-only strings so FullCalendar treats them as all-day.
    // FullCalendar's end is exclusive, so add 1 day to include the due date.
    allDay = true
    start  = isoToDateStr(task.startDate ?? task.dueDate ?? new Date().toISOString())
    end    = exclusiveEndDate(dateStr)
  }

  return {
    id: task.id,
    title: task.status === 'DONE' ? `✓ ${task.title}` : task.title,
    start,
    end,
    allDay,
    backgroundColor: PRIORITY_COLORS[task.priority] ?? '#6366f1',
    borderColor: PRIORITY_COLORS[task.priority] ?? '#6366f1',
    textColor: '#ffffff',
    extendedProps: { task },
    classNames: task.status === 'DONE' ? ['opacity-50'] : [],
  }
}

/** Format a Date as a local "HH:MM" string. */
function dateToTimeStr(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function CalendarView() {
  const { tasks, fetchTasks, updateTask } = useTaskStore()
  const openTaskForm = useUIStore((s) => s.openTaskForm)
  const calendarRef = useRef<FullCalendar>(null)

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  // Calendar honors the user's filters — same source as the task list. The
  // default filter (set in taskStore) hides CANCELLED but keeps DONE visible.
  const events = tasks.map(taskToEvent)

  const handleEventClick = (arg: EventClickArg) => {
    const task = arg.event.extendedProps.task as Task
    openTaskForm(task.id)
  }

  const handleDateClick = (arg: DateClickArg) => {
    // Single click on a day cell (month view) — no time range to pre-fill.
    // Time-range pre-fill is handled by `handleSelect` for drag-selections.
    // Also pre-fill startDate so the new task is bounded to the clicked day.
    openTaskForm(undefined, arg.dateStr, { startDate: arg.dateStr })
  }

  const handleSelect = (arg: DateSelectArg) => {
    // User dragged across a time range in week/day view — pre-fill BOTH the
    // start date and the time range in the new-task form so they don't have
    // to re-enter them. (Previously only dueDate got filled, which left the
    // Start Date blank in the form.)
    const dateStr = dateToLocalStr(arg.start)
    if (arg.allDay) {
      // All-day drag selection: use the date for both start and due, no time
      openTaskForm(undefined, dateStr, { startDate: dateStr })
    } else {
      openTaskForm(undefined, dateStr, {
        startDate: dateStr,
        startTime: dateToTimeStr(arg.start),
        endTime:   dateToTimeStr(arg.end),
      })
    }
    // Clear FullCalendar's visual selection so it doesn't linger
    calendarRef.current?.getApi().unselect()
  }

  const handleEventDrop = async (arg: EventDropArg) => {
    const task = arg.event.extendedProps.task as Task
    try {
      const newStart = arg.event.start ? dateToLocalStr(arg.event.start) : undefined
      // For all-day events FullCalendar returns an exclusive end, so subtract
      // 1 day to get the actual due date. Timed events have no adjustment.
      let newEnd: string | undefined
      if (arg.event.end) {
        if (arg.event.allDay) {
          const d = new Date(arg.event.end)
          d.setDate(d.getDate() - 1)
          newEnd = dateToLocalStr(d)
        } else {
          newEnd = dateToLocalStr(arg.event.end)
        }
      }
      await updateTask(task.id, {
        startDate: newStart,
        dueDate: newEnd ?? newStart,
      })
      toast.success('Task dates updated')
    } catch {
      arg.revert()
      toast.error('Failed to update task')
    }
  }

  return (
    <div className="fc-wrapper">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay',
        }}
        views={{
          timeGridWeek: { buttonText: 'week' },
          timeGridDay: { buttonText: 'day' },
          dayGridMonth: { buttonText: 'month' },
        }}
        events={events}
        editable
        droppable
        selectable
        eventClick={handleEventClick}
        dateClick={handleDateClick}
        select={handleSelect}
        eventDrop={handleEventDrop}
        height="calc(100vh - 240px)"
        stickyHeaderDates
        dayMaxEvents={3}
      />
    </div>
  )
}
