import { create } from 'zustand'
import type { Task } from '@/types'

export interface TaskFilters {
  status?: string[]
  priority?: string[]
  tags?: string[]
  search?: string
  dateFrom?: string
  dateTo?: string
}

/** Scope identifies which filter state a component is reading/writing.
 *  - 'list'     → the Task page filter (default hides DONE + CANCELLED)
 *  - 'calendar' → the Calendar page filter (default hides only CANCELLED)
 */
export type FilterScope = 'list' | 'calendar'

export interface CreateTaskResult {
  task: Task
  /** Extra occurrences generated when the task has recurrence info (0 otherwise). */
  occurrencesCreated: number
}

interface TaskStore {
  /** Filtered tasks — driven by the current `filters` state. Used by TaskList. */
  tasks: Task[]
  /** Unfiltered task list — used by Calendar view & Dashboard so they see
   *  every task regardless of the user's filter selections. */
  allTasks: Task[]
  filters: TaskFilters
  loading: boolean
  error: string | null

  fetchTasks: () => Promise<void>
  /** Fetch every task in the DB (no server-side status/priority/tag filter).
   *  Components that consume `allTasks` apply their own filtering as needed. */
  fetchAllTasks: () => Promise<void>
  createTask: (data: Partial<Task>) => Promise<CreateTaskResult>
  updateTask: (id: string, data: Partial<Task>, opts?: { scope?: 'task' | 'series' }) => Promise<Task>
  deleteTask: (id: string, opts?: { scope?: 'task' | 'series' }) => Promise<void>
  setFilters: (filters: TaskFilters) => void
  clearFilters: () => void

  /** Calendar-specific filter — independent from `filters` so the two views
   *  can have different defaults (Tasks hides DONE; Calendar shows DONE). */
  calendarFilters: TaskFilters
  setCalendarFilters: (filters: TaskFilters) => void
  clearCalendarFilters: () => void
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  allTasks: [],
  // Tasks page default: focus on active work — hide DONE + CANCELLED
  filters: { status: ['TODO', 'IN_PROGRESS'] },
  // Calendar page default: show everything except CANCELLED so completed
  // work remains visible historically
  calendarFilters: { status: ['TODO', 'IN_PROGRESS', 'DONE'] },
  loading: false,
  error: null,

  fetchTasks: async () => {
    set({ loading: true, error: null })
    try {
      const { filters } = get()
      const params = new URLSearchParams()
      if (filters.status?.length)   params.set('status',   filters.status.join(','))
      if (filters.priority?.length) params.set('priority', filters.priority.join(','))
      if (filters.tags?.length)     params.set('tags',     filters.tags.join(','))
      if (filters.search)   params.set('search',   filters.search)
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
      if (filters.dateTo)   params.set('dateTo',   filters.dateTo)

      const res = await fetch(`/api/tasks?${params}`)
      if (!res.ok) throw new Error('Failed to fetch tasks')
      const { tasks } = await res.json()
      set({ tasks, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  fetchAllTasks: async () => {
    try {
      // No params at all → server returns every task
      const res = await fetch('/api/tasks')
      if (!res.ok) throw new Error('Failed to fetch tasks')
      const { tasks } = await res.json()
      set({ allTasks: tasks })
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  createTask: async (data) => {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Failed to create task')
    const { task, occurrencesCreated = 0 } = await res.json()

    if (occurrencesCreated > 0) {
      // Bulk creation: re-fetch BOTH lists so the full series shows up everywhere
      await Promise.all([get().fetchTasks(), get().fetchAllTasks()])
    } else {
      set((s) => ({
        tasks: [task, ...s.tasks],
        allTasks: [task, ...s.allTasks],
      }))
    }
    return { task, occurrencesCreated }
  },

  updateTask: async (id, data, opts) => {
    const isSeries = opts?.scope === 'series'

    // Optimistic update — only safe for single-task edits
    if (!isSeries) {
      set((s) => ({
        tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...data } : t)),
        allTasks: s.allTasks.map((t) => (t.id === id ? { ...t, ...data } : t)),
      }))
    }
    const url = isSeries ? `/api/tasks/${id}?scope=series` : `/api/tasks/${id}`
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      await Promise.all([get().fetchTasks(), get().fetchAllTasks()])
      throw new Error('Failed to update task')
    }
    const { task } = await res.json()
    if (isSeries) {
      // Series edits touched many rows — re-fetch to reflect them all
      await Promise.all([get().fetchTasks(), get().fetchAllTasks()])
    } else {
      set((s) => ({
        tasks: s.tasks.map((t) => (t.id === id ? task : t)),
        allTasks: s.allTasks.map((t) => (t.id === id ? task : t)),
      }))
    }
    return task
  },

  deleteTask: async (id, opts) => {
    const isSeries = opts?.scope === 'series'
    const url = isSeries ? `/api/tasks/${id}?scope=series` : `/api/tasks/${id}`

    if (!isSeries) {
      // Optimistic remove for single-task delete
      set((s) => ({
        tasks: s.tasks.filter((t) => t.id !== id),
        allTasks: s.allTasks.filter((t) => t.id !== id),
      }))
    }
    const res = await fetch(url, { method: 'DELETE' })
    if (!res.ok) {
      await Promise.all([get().fetchTasks(), get().fetchAllTasks()])
      throw new Error('Failed to delete task')
    }
    if (isSeries) {
      // Series delete affected many rows — re-fetch
      await Promise.all([get().fetchTasks(), get().fetchAllTasks()])
    }
  },

  setFilters: (filters) => {
    set({ filters })
    get().fetchTasks()
  },

  clearFilters: () => {
    set({ filters: { status: ['TODO', 'IN_PROGRESS'] } })
    get().fetchTasks()
  },

  setCalendarFilters: (calendarFilters) => set({ calendarFilters }),
  clearCalendarFilters: () =>
    set({ calendarFilters: { status: ['TODO', 'IN_PROGRESS', 'DONE'] } }),
}))
