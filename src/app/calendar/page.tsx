'use client'

import dynamic from 'next/dynamic'

// FullCalendar must be loaded client-side only
const CalendarView = dynamic(
  () => import('@/components/calendar/CalendarView').then((m) => m.CalendarView),
  { ssr: false, loading: () => <div className="h-96 animate-pulse bg-gray-100 dark:bg-gray-800 rounded-lg" /> }
)

export default function CalendarPage() {
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Calendar</h1>
      <div className="bg-white dark:bg-gray-900 rounded-lg border p-2 md:p-4">
        <CalendarView />
      </div>
    </div>
  )
}
