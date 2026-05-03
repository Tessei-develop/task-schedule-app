import {
  isAfter,
  isBefore,
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

/**
 * Get the user's IANA timezone.
 *
 * On the server (Vercel runs in UTC) we use the USER_TIMEZONE env var.
 * In the browser we use the user's resolved timezone (always correct).
 *
 * This matters for date-only operations like "is this task due today" —
 * server's "today" (UTC) and user's "today" (e.g. America/Chicago) can
 * differ by a calendar day during the user's evening / early morning.
 */
export function getUserTimeZone(): string {
  if (typeof window === 'undefined' && process.env.USER_TIMEZONE) {
    return process.env.USER_TIMEZONE.trim()
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/** Today's date as YYYY-MM-DD in the user's timezone. */
function todayInUserTz(): string {
  const tz = getUserTimeZone()
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const y = parts.find(p => p.type === 'year')?.value ?? ''
  const m = parts.find(p => p.type === 'month')?.value ?? ''
  const d = parts.find(p => p.type === 'day')?.value ?? ''
  return `${y}-${m}-${d}`
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
  // Compare YYYY-MM-DD strings — robust against server UTC vs user-local
  // disagreements about what "today" means.
  return dueDate.slice(0, 10) === todayInUserTz()
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
  // User-timezone-aware "today". On Vercel (UTC) without this we'd get the
  // wrong calendar day during the user's late evening.
  return todayInUserTz()
}

/** Current wall-clock time in the user's timezone, e.g. "9:30 PM". */
export function nowInUserTz(): string {
  const tz = getUserTimeZone()
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date())
}

export function startOfDayISO(date: Date): string {
  return startOfDay(date).toISOString()
}

export function endOfDayISO(date: Date): string {
  return endOfDay(date).toISOString()
}
