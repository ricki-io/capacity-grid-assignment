import { describe, expect, it } from 'vitest'
import type { Capacity } from './api'
import { loadOf, overCountByWeek, withWeeklyHours } from './capacity'

describe('loadOf', () => {
  it('is over only when allocated is strictly more than capacity', () => {
    expect(loadOf(45, 40)).toBe('over')
    expect(loadOf(40, 40)).toBe('full')
    expect(loadOf(30, 40)).toBe('under')
    expect(loadOf(0, 40)).toBe('none')
  })

  it('handles a capacity of zero without dividing by it', () => {
    expect(loadOf(20, 0)).toBe('over')
    expect(loadOf(0, 0)).toBe('none')
  })
})

const capacity: Capacity = {
  weeks: ['2026-01-05', '2026-01-12'],
  people: [
    { id: 1, name: 'Ana', weeklyHours: 40, allocated: [40, 30] },
    { id: 4, name: 'Dee', weeklyHours: 40, allocated: [45, 40] },
    { id: 5, name: 'Eli', weeklyHours: 0, allocated: [20, 0] },
  ],
}

describe('overCountByWeek', () => {
  it('counts the people over in each week', () => {
    expect(overCountByWeek(capacity.people, 2)).toEqual([2, 0])
  })
})

describe('withWeeklyHours', () => {
  it('changes one person and the counts that follow from them', () => {
    const next = withWeeklyHours(capacity, 4, 50)
    expect(next.people[1].weeklyHours).toBe(50)
    expect(overCountByWeek(next.people, 2)).toEqual([1, 0])
  })

  it('leaves everyone else, and the original, untouched', () => {
    const next = withWeeklyHours(capacity, 4, 50)
    expect(next.people[0]).toBe(capacity.people[0])
    expect(next.people[2]).toBe(capacity.people[2])
    expect(capacity.people[1].weeklyHours).toBe(40)
  })

  it('returns the same object when there is nothing to change', () => {
    expect(withWeeklyHours(capacity, 4, 40)).toBe(capacity)
    expect(withWeeklyHours(capacity, 999, 50)).toBe(capacity)
  })
})
