import type { PersonCapacity } from './api'

export type Load = 'none' | 'under' | 'full' | 'over'

/**
 * How booked someone is in one week. Over means strictly more than capacity:
 * 40 of 40 is full, not over. Hours are compared, never a percentage, so a
 * capacity of zero needs no special case.
 */
export function loadOf(allocated: number, capacity: number): Load {
  if (allocated > capacity) return 'over'
  if (allocated === 0) return 'none'
  if (allocated === capacity) return 'full'
  return 'under'
}

export function isOverInAnyWeek(person: PersonCapacity): boolean {
  return person.allocated.some((hours) => hours > person.weeklyHours)
}

/** For each week, how many people are over-allocated. */
export function overCountByWeek(people: PersonCapacity[], weekCount: number): number[] {
  const counts = new Array<number>(weekCount).fill(0)
  for (const person of people) {
    person.allocated.forEach((hours, week) => {
      if (hours > person.weeklyHours) counts[week] += 1
    })
  }
  return counts
}

const hoursFormat = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 })

/** "37.5h" */
export function formatHours(hours: number): string {
  return `${hoursFormat.format(hours)}h`
}
