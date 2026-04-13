import {
  isAfter,
  isBefore,
  isToday,
  startOfDay,
  endOfDay,
  format,
  formatDistanceToNow,
  addDays,
  parseISO,
} from 'date-fns'

export function isOverdue(dueDate: string | null, status: string): boolean {
  if (!dueDate || status === 'DONE' || status === 'CANCELLED') return false
  return isBefore(parseISO(dueDate), startOfDay(new Date()))
}

export function isDueToday(dueDate: string | null): boolean {
  if (!dueDate) return false
  return isToday(parseISO(dueDate))
}

export function isDueThisWeek(dueDate: string | null): boolean {
  if (!dueDate) return false
  const d = parseISO(dueDate)
  const now = new Date()
  return isAfter(d, now) && isBefore(d, addDays(now, 7))
}

export function formatDueDate(dueDate: string | null): string {
  if (!dueDate) return ''
  return format(parseISO(dueDate), 'MMM d, yyyy')
}

export function formatRelativeDate(date: string | null): string {
  if (!date) return ''
  return formatDistanceToNow(parseISO(date), { addSuffix: true })
}

export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function startOfDayISO(date: Date): string {
  return startOfDay(date).toISOString()
}

export function endOfDayISO(date: Date): string {
  return endOfDay(date).toISOString()
}
