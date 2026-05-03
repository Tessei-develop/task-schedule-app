import { addDays, addWeeks, addMonths, addYears } from 'date-fns'
import type { RecurrenceType } from '@/types'

// Hard cap on how many occurrences can be generated at once. Protects against
// pathological inputs (e.g. daily for 100 years) that would explode the DB.
export const MAX_OCCURRENCES = 365

/**
 * Given the FIRST occurrence's start/due dates and recurrence rules, return all
 * SUBSEQUENT (start, due) pairs up to and including endDate.
 *
 * The first occurrence itself is NOT included — the caller already creates it
 * directly and only needs the additional copies.
 *
 * For WEEKDAY/WEEKEND, the `interval` parameter is ignored — the cadence is
 * always "every qualifying day" (Mon-Fri or Sat-Sun respectively).
 */
export function generateOccurrenceDates(opts: {
  firstStart: Date | null
  firstDue: Date
  endDate: Date
  type: RecurrenceType
  interval: number
}): Array<{ start: Date | null; due: Date }> {
  const { firstStart, firstDue, endDate, type, interval } = opts
  const result: Array<{ start: Date | null; due: Date }> = []

  // The "anchor" we step from. Keep start and due in lockstep so the duration
  // (start → due) is preserved across occurrences.
  let cursorStart = firstStart
  let cursorDue   = firstDue
  const stepN = Math.max(1, interval)

  while (result.length < MAX_OCCURRENCES) {
    let nextStart: Date | null
    let nextDue:   Date

    switch (type) {
      case 'DAILY':
        nextStart = cursorStart ? addDays(cursorStart, stepN) : null
        nextDue   = addDays(cursorDue, stepN)
        break
      case 'WEEKLY':
        nextStart = cursorStart ? addWeeks(cursorStart, stepN) : null
        nextDue   = addWeeks(cursorDue, stepN)
        break
      case 'MONTHLY':
        nextStart = cursorStart ? addMonths(cursorStart, stepN) : null
        nextDue   = addMonths(cursorDue, stepN)
        break
      case 'YEARLY':
        nextStart = cursorStart ? addYears(cursorStart, stepN) : null
        nextDue   = addYears(cursorDue, stepN)
        break
      case 'WEEKDAY':
        nextStart = cursorStart ? nextWeekday(cursorStart) : null
        nextDue   = nextWeekday(cursorDue)
        break
      case 'WEEKEND':
        nextStart = cursorStart ? nextWeekendDay(cursorStart) : null
        nextDue   = nextWeekendDay(cursorDue)
        break
      default:
        return result
    }

    // Stop when we've gone past the user's end date
    if (nextDue.getTime() > endDate.getTime()) break

    result.push({ start: nextStart, due: nextDue })
    cursorStart = nextStart
    cursorDue   = nextDue
  }

  return result
}

/** Next Mon-Fri after `date`. If `date` is Fri, returns next Mon (skips Sat/Sun). */
function nextWeekday(date: Date): Date {
  const next = addDays(date, 1)
  const day = next.getDay() // 0 = Sun ... 6 = Sat
  if (day === 6) return addDays(next, 2) // Sat → Mon
  if (day === 0) return addDays(next, 1) // Sun → Mon
  return next
}

/** Next Sat or Sun after `date`. If `date` is a weekday, jumps to next Saturday. */
function nextWeekendDay(date: Date): Date {
  const next = addDays(date, 1)
  const day = next.getDay()
  // 1 = Mon ... 5 = Fri → jump to Saturday (day 6)
  if (day >= 1 && day <= 5) return addDays(next, 6 - day)
  return next
}
