export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED'
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
export type RecurrenceType = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'

export const PRESET_TAGS = ['work', 'personal', 'family', 'others'] as const

export interface Task {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  startDate: string | null
  dueDate: string | null
  completedAt: string | null
  estimatedMinutes: number | null
  startTime: string | null      // "HH:MM" 24h format
  endTime: string | null        // "HH:MM" 24h format
  tags: string[]
  recurrence: RecurrenceType | null
  recurrenceInterval: number | null  // e.g. every 2 weeks → interval=2
  recurrenceEndDate: string | null
  googleCalendarEventId: string | null
  googleCalendarSynced: boolean
  createdAt: string
  updatedAt: string
}

export interface DailyPlanItem {
  taskId: string
  title: string
  suggestedTimeSlot: string
  reasoning: string
  estimatedMinutes: number
}

export interface DailyPlan {
  date: string
  introduction: string
  schedule: DailyPlanItem[]
  totalEstimatedMinutes: number
  tips: string[]
}

export interface ProductivityFeedback {
  period: string
  completionRate: number
  score: number
  strengths: string[]
  areasToImprove: string[]
  actionableAdvice: string[]
  motivationalMessage: string
}
