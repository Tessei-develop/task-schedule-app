'use client'

import { useEffect, useRef } from 'react'
import { useTaskStore } from '@/store/taskStore'

/**
 * Silently syncs from Google Calendar once when the app loads,
 * if Google Calendar is connected. Runs in the background — no toast,
 * no spinner. Tasks refresh automatically after sync completes.
 */
export function AutoSync() {
  const { fetchTasks } = useTaskStore()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    ;(async () => {
      try {
        const status = await fetch('/api/google/status').then((r) => r.json())
        if (!status.connected) return

        const res = await fetch('/api/google/sync', { method: 'POST' })
        if (res.ok) await fetchTasks()
      } catch {
        // Silent — auto-sync is best-effort
      }
    })()
  }, [fetchTasks])

  return null
}
