import { useState } from 'react'
import { CapacityGrid } from './CapacityGrid'
import { RangeControls } from './RangeControls'
import { normalizeRange } from './weeks'

// The weeks the page opens on. The seed is a fixed snapshot and these are the
// weeks its hand-made cases sit in; in production this would be the current
// week, which is one click away on "Today".
const INITIAL_RANGE = normalizeRange('2025-12-29', '2026-01-16')

// The range lives here rather than inside the grid: the grid is one part of
// the team overview, and the timeline next to it will show the same weeks.
export function App() {
  const [range, setRange] = useState(INITIAL_RANGE)

  return (
    <main className="page">
      <section className="panel">
        <header className="panel-header">
          <h1>Team capacity</h1>
          <p className="panel-lede">
            Hours allocated each week against each person's weekly capacity. Weekdays only.
          </p>
        </header>
        <RangeControls range={range} onChange={setRange} />
        <CapacityGrid from={range.from} to={range.to} />
      </section>
    </main>
  )
}
