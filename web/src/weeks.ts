// Dates travel as YYYY-MM-DD strings, and all arithmetic happens in UTC, so
// the manager's timezone can never push a date across midnight.

const DAY_MS = 24 * 60 * 60 * 1000

const dayFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})

function toUtc(date: string): number {
  const [year, month, day] = date.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

export function addDays(date: string, days: number): string {
  return fromUtc(toUtc(date) + days * DAY_MS)
}

/** The Monday of the week `date` falls in. Weeks run Monday to Sunday. */
export function mondayOf(date: string): string {
  const daysSinceMonday = (new Date(toUtc(date)).getUTCDay() + 6) % 7
  return addDays(date, -daysSinceMonday)
}

/** Today's date on the manager's own calendar. */
export function today(): string {
  const now = new Date()
  return fromUtc(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
}

/** "29 Dec" */
export function formatDay(date: string): string {
  return dayFormat.format(toUtc(date))
}

/** The most weeks one view can cover. Matches the cap the API enforces. */
export const MAX_WEEKS = 26

/** Whole weeks: `from` is always a Monday and `to` the Sunday that ends a week. */
export type Range = {
  from: string
  to: string
}

export function weekCount(range: Range): number {
  const days = (toUtc(range.to) - toUtc(range.from)) / DAY_MS + 1
  return Math.round(days / 7)
}

/** A range of `weeks` whole weeks starting with the week `date` falls in. */
export function rangeOfWeeks(date: string, weeks: number): Range {
  const from = mondayOf(date)
  return { from, to: addDays(from, weeks * 7 - 1) }
}

export function shiftRange(range: Range, weeks: number): Range {
  return { from: addDays(range.from, weeks * 7), to: addDays(range.to, weeks * 7) }
}

/**
 * Turns any two dates into a valid range: widened to whole weeks, never
 * backwards, never longer than MAX_WEEKS. `keep` is the end the manager just
 * picked; when the two disagree, that end stays put and the other one moves.
 */
export function normalizeRange(from: string, to: string, keep: 'from' | 'to' = 'from'): Range {
  const first = mondayOf(from)
  const last = mondayOf(to)
  const weeks = Math.round((toUtc(last) - toUtc(first)) / DAY_MS / 7) + 1
  const clamped = Math.min(Math.max(weeks, 1), MAX_WEEKS)

  return keep === 'from'
    ? rangeOfWeeks(first, clamped)
    : { from: addDays(last, -(clamped - 1) * 7), to: addDays(last, 6) }
}
