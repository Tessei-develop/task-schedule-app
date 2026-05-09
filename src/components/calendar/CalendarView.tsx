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
  const { allTasks, fetchAllTasks, calendarFilters, updateTask } = useTaskStore()
  const openTaskForm = useUIStore((s) => s.openTaskForm)
  const calendarRef = useRef<FullCalendar>(null)

  useEffect(() => {
    fetchAllTasks()
  }, [fetchAllTasks])

  // Calendar applies its OWN filter (calendarFilters) to the unfiltered list.
  // This lets the Tasks page hide DONE by default while the Calendar shows it.
  const filtered = allTasks.filter((t) => {
    const f = calendarFilters
    if (f.status?.length   && !f.status.includes(t.status))     return false
    if (f.priority?.length && !f.priority.includes(t.priority)) return false
    // Tag filter: task must contain ALL selected tags (matches API's `hasEvery`)
    if (f.tags?.length && !f.tags.every((tag) => t.tags.includes(tag))) return false
    if (f.search) {
      const s = f.search.toLowerCase()
      const inTitle = t.title.toLowerCase().includes(s)
      const inDesc  = !!t.description?.toLowerCase().includes(s)
      if (!inTitle && !inDesc) return false
    }
    if (f.dateFrom && (!t.dueDate || t.dueDate.slice(0, 10) < f.dateFrom)) return false
    if (f.dateTo   && (!t.dueDate || t.dueDate.slice(0, 10) > f.dateTo))   return false
    return true
  })
  const events = filtered.map(taskToEvent)

  const handleEventClick = (arg: EventClickArg) => {
    const task = arg.event.extendedProps.task as Task
    openTaskForm(task.id)
  }

  // ─── Click + drag handling ─────────────────────────────────────────────────
  // FullCalendar v6 fires BOTH `select` and `dateClick` for the same gesture
  // when `selectable: true`, but the order/timing varies between views. We
  // route everything through one helper and use a tiny dedupe so the second
  // event of a single gesture doesn't clobber the first call's prefill.
  const lastOpenAtRef = useRef(0)

  const openWithPrefill = (
    start: Date,
    end: Date | null,
    allDay: boolean,
  ) => {
    // Coalesce duplicate calls within ~250ms of each other (same gesture)
    const now = Date.now()
    if (now - lastOpenAtRef.current < 250) return
    lastOpenAtRef.current = now

    const dateStr = dateToLocalStr(start)
    if (allDay) {
      openTaskForm(undefined, dateStr, { startDate: dateStr })
    } else {
      // Single-click in time grid → end is start (zero-length); default 30min
      const realEnd =
        end && end.getTime() > start.getTime()
          ? end
          : new Date(start.getTime() + 30 * 60 * 1000)
      openTaskForm(undefined, dateStr, {
        startDate: dateStr,
        startTime: dateToTimeStr(start),
        endTime:   dateToTimeStr(realEnd),
      })
    }
  }

  const handleDateClick = (arg: DateClickArg) => {
    openWithPrefill(arg.date, null, arg.allDay)
  }

  const handleSelect = (arg: DateSelectArg) => {
    openWithPrefill(arg.start, arg.end, arg.allDay)
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
