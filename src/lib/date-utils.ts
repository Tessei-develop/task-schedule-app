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

// Strip the time/timezone portion so dates are always interpreted as local midnight,
// preventing UTC→local timezone shifts from moving dates to the wrong day.
function localDate(isoString: string): Date {
  return parseISO(isoString.slice(0, 10))
}

export function isOverdue(dueDate: string | null, status: string, endTime?: string | null): boolean {
  if (!dueDate || status === 'DONE' || status === 'CANCELLED') return false
  const due = localDate(dueDate)
  if (endTime) {
    const [h, m] = endTime.split(':').map(Number)
    due.setHours(h, m, 0, 0)
    return isBefore(due, new Date())
  }
  return isBefore(endOfDay(due), new Date())
}

export function isDueToday(dueDate: string | null): boolean {
  if (!dueDate) return false
  return isToday(localDate(dueDate))
}

export function isDueThisWeek(dueDate: string | null): boolean {
  if (!dueDate) return false
  const d = localDate(dueDate)
  const now = new Date()
  return isAfter(d, now) && isBefore(d, addDays(now, 7))
}

export function formatDueDate(dueDate: string | null): string {
  if (!dueDate) return ''
  return format(localDate(dueDate), 'MMM d, yyyy')
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
