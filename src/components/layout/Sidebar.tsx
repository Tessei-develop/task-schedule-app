'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import {
  LayoutDashboard,
  ListTodo,
  Calendar,
  CalendarCheck,
  Plus,
  RefreshCw,
  Unlink,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/uiStore'
import { useTaskStore } from '@/store/taskStore'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/tasks', label: 'Tasks', icon: ListTodo },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
]

function GoogleCalendarSection() {
  const [connected, setConnected] = useState<boolean | null>(null)
  const [syncing, setSyncing] = useState(false)
  const { fetchTasks } = useTaskStore()

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/google/status')
      const data = await res.json()
      setConnected(data.connected)
    } catch {
      setConnected(false)
    }
  }, [])

  useEffect(() => { checkStatus() }, [checkStatus])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/google/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await fetchTasks()
      toast.success(
        `Synced! +${data.created} new, ${data.updated} updated, ${data.deleted} removed`
      )
    } catch (err) {
      toast.error(`Sync failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setSyncing(false)
    }
  }

  const handleDisconnect = async () => {
    try {
      await fetch('/api/google/status', { method: 'DELETE' })
      setConnected(false)
      toast.success('Google Calendar disconnected')
    } catch {
      toast.error('Failed to disconnect')
    }
  }

  if (connected === null) return null // loading

  if (!connected) {
    return (
      <a
        href="/api/google/auth"
        className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <CalendarCheck className="h-4 w-4" />
        Connect Google Calendar
      </a>
    )
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 px-3 py-1">
        <CalendarCheck className="h-4 w-4 text-green-500 flex-shrink-0" />
        <span className="text-xs font-medium text-green-600 dark:text-green-400 truncate">
          Google Calendar
        </span>
      </div>
      <button
        onClick={handleSync}
        disabled={syncing}
        className="flex w-full items-center gap-2 px-3 py-1.5 rounded-md text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
      >
        {syncing
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <RefreshCw className="h-3.5 w-3.5" />}
        Sync from Google
      </button>
      <button
        onClick={handleDisconnect}
        className="flex w-full items-center gap-2 px-3 py-1.5 rounded-md text-sm text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-red-500 transition-colors"
      >
        <Unlink className="h-3.5 w-3.5" />
        Disconnect
      </button>
    </div>
  )
}

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

          {/* Google Calendar section sits directly under the Calendar nav item */}
          <div className="ml-3 pl-4 border-l border-gray-200 dark:border-gray-700">
            <GoogleCalendarSection />
          </div>
        </nav>
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
