import { useEffect, useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'
import {
  MAX_WEEKS,
  formatDay,
  normalizeRange,
  rangeOfWeeks,
  shiftRange,
  today,
  weekCount,
  type Range,
} from './weeks'

type Props = {
  range: Range
  onChange: (range: Range) => void
}

// The date inputs accept anything typeable, including half-typed years, so a
// date only counts once it is somewhere a team could plausibly have data.
const EARLIEST = '2000-01-01'
const LATEST = '2100-12-31'

// RangeControls moves the window of weeks the page shows: a week at a time,
// back to today, or to any range picked by date.
export function RangeControls({ range, onChange }: Props) {
  const weeks = weekCount(range)

  return (
    <div className="range-controls" role="group" aria-label="Weeks shown">
      {/* One joined control, read left to right: step back, the range, step on. */}
      <div className="range-group">
        <button
          type="button"
          className="icon-button"
          aria-label="Previous week"
          onClick={() => onChange(shiftRange(range, -1))}
        >
          <ChevronLeftIcon />
        </button>
        <DateField
          label="From"
          value={range.from}
          onPick={(date) => onChange(normalizeRange(date, range.to, 'from'))}
        />
        <DateField
          label="To"
          value={range.to}
          onPick={(date) => onChange(normalizeRange(range.from, date, 'to'))}
        />
        <button
          type="button"
          className="icon-button"
          aria-label="Next week"
          onClick={() => onChange(shiftRange(range, 1))}
        >
          <ChevronRightIcon />
        </button>
      </div>

      <button type="button" onClick={() => onChange(rangeOfWeeks(today(), weeks))}>
        Today
      </button>

      <p className="range-summary">
        {formatDay(range.from)} {range.from.slice(0, 4)} to {formatDay(range.to)}{' '}
        {range.to.slice(0, 4)} · {weeks} {weeks === 1 ? 'week' : 'weeks'}
        <span className="range-hint"> · whole weeks, Monday to Sunday, up to {MAX_WEEKS}</span>
      </p>
    </div>
  )
}

function DateField({
  label,
  value,
  onPick,
}: {
  label: string
  value: string
  onPick: (date: string) => void
}) {
  // What is typed is kept apart from the range, so a half-typed date does not
  // move the grid. The range wins again whenever it changes or focus leaves.
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])

  return (
    <label className="date-field">
      <span className="date-field-label">{label}</span>
      <input
        type="date"
        value={draft}
        min={EARLIEST}
        max={LATEST}
        onChange={(event) => {
          const date = event.target.value
          setDraft(date)
          if (date >= EARLIEST && date <= LATEST) onPick(date)
        }}
        onBlur={() => setDraft(value)}
      />
    </label>
  )
}
