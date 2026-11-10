import { describe, expect, it } from 'vitest'
import { MAX_WEEKS, mondayOf, normalizeRange, shiftRange, weekCount } from './weeks'

describe('mondayOf', () => {
  it('finds the Monday across a year boundary', () => {
    expect(mondayOf('2026-01-01')).toBe('2025-12-29')
  })

  it('treats Sunday as the last day of the week, not the first', () => {
    expect(mondayOf('2026-01-04')).toBe('2025-12-29')
    expect(mondayOf('2026-01-05')).toBe('2026-01-05')
  })

  it('is not moved by a daylight saving change', () => {
    expect(mondayOf('2026-03-29')).toBe('2026-03-23')
  })
})

describe('normalizeRange', () => {
  it('widens a range that ends mid-week to whole weeks', () => {
    const range = normalizeRange('2025-12-29', '2026-01-16')
    expect(range).toEqual({ from: '2025-12-29', to: '2026-01-18' })
    expect(weekCount(range)).toBe(3)
  })

  it('never goes backwards: the end that was just picked wins', () => {
    expect(normalizeRange('2026-01-14', '2026-01-01', 'from')).toEqual({
      from: '2026-01-12',
      to: '2026-01-18',
    })
    expect(normalizeRange('2026-01-14', '2026-01-01', 'to')).toEqual({
      from: '2025-12-29',
      to: '2026-01-04',
    })
  })

  it('stops at the longest range the API accepts', () => {
    const fromKept = normalizeRange('2026-01-05', '2027-06-30', 'from')
    expect(fromKept.from).toBe('2026-01-05')
    expect(weekCount(fromKept)).toBe(MAX_WEEKS)

    const toKept = normalizeRange('2026-01-05', '2027-06-30', 'to')
    expect(toKept.to).toBe('2027-07-04')
    expect(weekCount(toKept)).toBe(MAX_WEEKS)
  })
})

describe('shiftRange', () => {
  it('moves both ends by whole weeks and keeps the length', () => {
    const range = { from: '2025-12-29', to: '2026-01-18' }
    expect(shiftRange(range, 1)).toEqual({ from: '2026-01-05', to: '2026-01-25' })
    expect(shiftRange(range, -1)).toEqual({ from: '2025-12-22', to: '2026-01-11' })
  })
})
