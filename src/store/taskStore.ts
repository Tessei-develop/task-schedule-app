import { create } from 'zustand'
import type { Task } from '@/types'

interface TaskFilters {
  status?: string
  priority?: string
  search?: string
  dateFrom?: string
  dateTo?: string
}

interface TaskStore {
  tasks: Task[]
  filters: TaskFilters
  loading: boolean
  error: string | null

  fetchTasks: () => Promise<void>
  createTask: (data: Partial<Task>) => Promise<Task>
  updateTask: (id: string, data: Partial<Task>) => Promise<Task>
  deleteTask: (id: string) => Promise<void>
  setFilters: (filters: TaskFilters) => void
  clearFilters: () => void
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  filters: {},
  loading: false,
  error: null,

  fetchTasks: async () => {
    set({ loading: true, error: null })
    try {
      const { filters } = get()
      const params = new URLSearchParams()
      if (filters.status) params.set('status', filters.status)
      if (filters.priority) params.set('priority', filters.priority)
      if (filters.search) params.set('search', filters.search)
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
      if (filters.dateTo) params.set('dateTo', filters.dateTo)

      const res = await fetch(`/api/tasks?${params}`)
      if (!res.ok) throw new Error('Failed to fetch tasks')
      const { tasks } = await res.json()
      set({ tasks, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  createTask: async (data) => {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Failed to create task')
    const { task } = await res.json()
    set((s) => ({ tasks: [task, ...s.tasks] }))
    return task
  },

  updateTask: async (id, data) => {
    // Optimistic update
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...data } : t)),
    }))
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      // Revert on failure
      await get().fetchTasks()
      throw new Error('Failed to update task')
    }
    const { task } = await res.json()
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? task : t)),
    }))
    return task
  },

  deleteTask: async (id) => {
    // Optimistic remove
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }))
    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      await get().fetchTasks()
      throw new Error('Failed to delete task')
    }
  },

  setFilters: (filters) => {
    set({ filters })
    get().fetchTasks()
  },

  clearFilters: () => {
    set({ filters: {} })
    get().fetchTasks()
  },
}))
