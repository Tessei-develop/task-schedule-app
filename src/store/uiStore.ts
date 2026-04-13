import { create } from 'zustand'

interface UIStore {
  isTaskFormOpen: boolean
  editingTaskId: string | null
  prefillDate: string | null

  openTaskForm: (taskId?: string, date?: string) => void
  closeTaskForm: () => void
}

export const useUIStore = create<UIStore>((set) => ({
  isTaskFormOpen: false,
  editingTaskId: null,
  prefillDate: null,

  openTaskForm: (taskId, date) =>
    set({ isTaskFormOpen: true, editingTaskId: taskId ?? null, prefillDate: date ?? null }),

  closeTaskForm: () =>
    set({ isTaskFormOpen: false, editingTaskId: null, prefillDate: null }),
}))
