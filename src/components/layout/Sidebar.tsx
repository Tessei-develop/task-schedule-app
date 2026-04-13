'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ListTodo,
  Calendar,
  CalendarCheck,
  Plus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/uiStore'
import { Button } from '@/components/ui/button'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/tasks', label: 'Tasks', icon: ListTodo },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
]

export function Sidebar() {
  const pathname = usePathname()
  const openTaskForm = useUIStore((s) => s.openTaskForm)

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 min-h-screen bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 px-3 py-4 gap-1">
        <div className="px-3 mb-4">
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-6 w-6 text-indigo-600" />
            <span className="font-bold text-lg text-gray-900 dark:text-white">TaskFlow</span>
          </div>
        </div>

        <Button
          onClick={() => openTaskForm()}
          className="mb-3 w-full justify-start gap-2"
          size="sm"
        >
          <Plus className="h-4 w-4" />
          New Task
        </Button>

        <nav className="flex flex-col gap-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                pathname === href
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto pt-4 border-t border-gray-200 dark:border-gray-800">
          <a
            href="/api/google/auth"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <CalendarCheck className="h-4 w-4" />
            Connect Google Calendar
          </a>
        </div>
      </aside>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex items-center justify-around px-2 py-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-col items-center gap-0.5 px-4 py-2 rounded-md text-xs font-medium transition-colors min-w-[44px]',
              pathname === href
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-gray-500 dark:text-gray-400'
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
        <button
          onClick={() => openTaskForm()}
          className="flex flex-col items-center gap-0.5 px-4 py-2 rounded-md text-xs font-medium text-indigo-600 dark:text-indigo-400 min-w-[44px]"
        >
          <Plus className="h-5 w-5" />
          New
        </button>
      </nav>
    </>
  )
}
