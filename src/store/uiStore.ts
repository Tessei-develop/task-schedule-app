import { create } from 'zustand'

export interface TaskPrefill {
  title?: string
  dueDate?: string
  startTime?: string
  endTime?: string
  estimatedMinutes?: string
  tags?: string[]
}

interface UIStore {
  isTaskFormOpen: boolean
  editingTaskId: string | null
  prefillDate: string | null
  prefillData: TaskPrefill | null

  openTaskForm: (taskId?: string, date?: string, prefill?: TaskPrefill) => void
  closeTaskForm: () => void
}

export const useUIStore = create<UIStore>((set) => ({
  isTaskFormOpen: false,
  editingTaskId: null,
  prefillDate: null,
  prefillData: null,

  openTaskForm: (taskId, date, prefill) =>
    set({
      isTaskFormOpen: true,
      editingTaskId: taskId ?? null,
      prefillDate: date ?? null,
      prefillData: prefill ?? null,
    }),

  closeTaskForm: () =>
    set({ isTaskFormOpen: false, editingTaskId: null, prefillDate: null, prefillData: null }),
}))
