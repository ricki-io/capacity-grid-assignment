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
