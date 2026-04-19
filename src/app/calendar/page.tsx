'use client'

import dynamic from 'next/dynamic'
import { TaskFilters } from '@/components/tasks/TaskFilters'

// FullCalendar must be loaded client-side only
const CalendarView = dynamic(
  () => import('@/components/calendar/CalendarView').then((m) => m.CalendarView),
  { ssr: false, loading: () => <div className="h-96 animate-pulse bg-gray-100 dark:bg-gray-800 rounded-lg" /> }
)

export default function CalendarPage() {
  return (
    <div className="flex flex-col h-screen max-w-7xl mx-auto">
      {/* Sticky filter bar on mobile; normal flow on desktop */}
      <div className="sticky top-0 z-30 bg-background md:static md:bg-transparent shrink-0 px-3 pt-3 pb-2 md:px-6 md:pt-6 md:pb-3 border-b border-border md:border-none shadow-sm md:shadow-none">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-2 md:mb-3">Calendar</h1>
        <TaskFilters />
      </div>
      <div className="flex-1 min-h-0 overflow-hidden px-3 pb-3 md:px-6 md:pb-6">
        <div className="bg-white dark:bg-gray-900 rounded-lg border p-2 md:p-4 h-full overflow-hidden">
          <CalendarView />
        </div>
      </div>
    </div>
  )
}
