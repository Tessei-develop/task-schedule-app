'use client'

import { useEffect, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventClickArg, EventDropArg } from '@fullcalendar/core'
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

function taskToEvent(task: Task) {
  return {
    id: task.id,
    title: task.status === 'DONE' ? `✓ ${task.title}` : task.title,
    start: task.startDate ?? task.dueDate ?? undefined,
    end: task.dueDate ?? undefined,
    backgroundColor: PRIORITY_COLORS[task.priority] ?? '#6366f1',
    borderColor: PRIORITY_COLORS[task.priority] ?? '#6366f1',
    textColor: '#ffffff',
    extendedProps: { task },
    classNames: task.status === 'DONE' ? ['opacity-50'] : [],
  }
}

export function CalendarView() {
  const { tasks, fetchTasks, updateTask } = useTaskStore()
  const openTaskForm = useUIStore((s) => s.openTaskForm)
  const calendarRef = useRef<FullCalendar>(null)

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const events = tasks.map(taskToEvent)

  const handleEventClick = (arg: EventClickArg) => {
    const task = arg.event.extendedProps.task as Task
    openTaskForm(task.id)
  }

  const handleDateClick = (arg: DateClickArg) => {
    openTaskForm(undefined, arg.dateStr)
  }

  const handleEventDrop = async (arg: EventDropArg) => {
    const task = arg.event.extendedProps.task as Task
    try {
      await updateTask(task.id, {
        dueDate: arg.event.end?.toISOString() ?? arg.event.start?.toISOString() ?? undefined,
        startDate: arg.event.start?.toISOString() ?? undefined,
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
        events={events}
        editable
        droppable
        selectable
        eventClick={handleEventClick}
        dateClick={handleDateClick}
        eventDrop={handleEventDrop}
        height="auto"
        dayMaxEvents={3}
      />
    </div>
  )
}
