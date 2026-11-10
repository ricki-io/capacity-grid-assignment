import { memo, useMemo, useState } from 'react'
import type { PersonCapacity } from './api'
import { formatHours, isOverInAnyWeek, loadOf, overCountByWeek } from './capacity'
import { useCapacity } from './useCapacity'
import { addDays, formatDay, mondayOf, today } from './weeks'

type Props = {
  from: string
  to: string
}

// CapacityGrid renders one row per person and one column per week, showing
// how allocated each person is and making over-allocation obvious.
//
// Everything on screen is worked out from the capacity response while
// rendering. Nothing derived (totals, over counts, cell states) is stored, so
// a change to someone's weekly hours cannot leave a stale number behind.
export function CapacityGrid({ from, to }: Props) {
  const { data, error, isFetching, isPlaceholderData, refetch } = useCapacity(from, to)
  const [onlyOver, setOnlyOver] = useState(false)

  const overByWeek = useMemo(
    () => (data ? overCountByWeek(data.people, data.weeks.length) : []),
    [data],
  )
  const overPeople = useMemo(() => (data ? data.people.filter(isOverInAnyWeek) : []), [data])

  if (!data) {
    return error ? (
      <LoadError message={error.message} retrying={isFetching} onRetry={() => refetch()} />
    ) : (
      <LoadingGrid />
    )
  }

  const people = onlyOver ? overPeople : data.people
  const thisWeek = mondayOf(today())

  return (
    <section className="capacity">
      <div className="capacity-bar">
        <p className="capacity-summary">
          <strong>{overPeople.length}</strong> of {data.people.length} people are over-allocated in
          these weeks
        </p>
        <label className="only-over">
          <input
            type="checkbox"
            checked={onlyOver}
            onChange={(event) => setOnlyOver(event.target.checked)}
          />
          Over-allocated only
        </label>
      </div>

      {isPlaceholderData && (
        <p className="notice" role="status">
          Loading {formatDay(from)} to {formatDay(to)}… Showing the previous weeks until it arrives.
        </p>
      )}
      {error && (
        <p className="notice notice-error" role="alert">
          Could not refresh: {error.message} These numbers may be out of date.{' '}
          <button type="button" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? 'Retrying…' : 'Try again'}
          </button>
        </p>
      )}

      {people.length === 0 ? (
        <p className="empty">
          {data.people.length === 0
            ? 'There is nobody on this team yet.'
            : 'Nobody is over-allocated in these weeks.'}
        </p>
      ) : (
        <div className="grid-scroll" aria-busy={isPlaceholderData}>
          <table className="grid">
            <thead>
              <tr>
                <th scope="col" className="person-col">
                  Person
                </th>
                {data.weeks.map((week, index) => (
                  <th
                    scope="col"
                    key={week}
                    className={week === thisWeek ? 'week-col this-week' : 'week-col'}
                  >
                    <span className="week-label">
                      {formatDay(week)} – {formatDay(addDays(week, 6))}
                    </span>
                    <span className={overByWeek[index] > 0 ? 'week-over' : 'week-over week-over-none'}>
                      {overByWeek[index] > 0 ? `${overByWeek[index]} over` : 'none over'}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map((person) => (
                <PersonRow key={person.id} person={person} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// Memoised because the query keeps unchanged people referentially equal:
// editing one person re-renders one row, not all of them.
const PersonRow = memo(function PersonRow({ person }: { person: PersonCapacity }) {
  return (
    <tr>
      <th scope="row" className="person-col">
        {/* bdi keeps right-to-left names from reordering the text around them */}
        <bdi className="person-name">{person.name}</bdi>
        <span className="person-capacity">{formatHours(person.weeklyHours)} / week</span>
      </th>
      {person.allocated.map((allocated, week) => (
        <WeekCell key={week} allocated={allocated} capacity={person.weeklyHours} />
      ))}
    </tr>
  )
})

function WeekCell({ allocated, capacity }: { allocated: number; capacity: number }) {
  const load = loadOf(allocated, capacity)
  if (load === 'none') {
    return (
      <td className="cell cell-none">
        <span aria-label="Nothing allocated">–</span>
      </td>
    )
  }

  const filled = capacity > 0 ? Math.min(allocated / capacity, 1) : 1
  return (
    <td className={`cell cell-${load}`}>
      <span className="cell-hours">{formatHours(allocated)}</span>
      {load === 'over' && <span className="cell-note">+{formatHours(allocated - capacity)} over</span>}
      {load === 'full' && <span className="cell-note">full</span>}
      <span className="cell-meter" aria-hidden="true">
        <span style={{ width: `${filled * 100}%` }} />
      </span>
    </td>
  )
}

function LoadingGrid() {
  return (
    <div className="loading" role="status" aria-label="Loading capacity">
      {Array.from({ length: 8 }, (_, row) => (
        <div className="loading-row" key={row} />
      ))}
    </div>
  )
}

function LoadError({
  message,
  retrying,
  onRetry,
}: {
  message: string
  retrying: boolean
  onRetry: () => void
}) {
  return (
    <div className="load-error" role="alert">
      <p>
        <strong>Capacity could not be loaded.</strong> {message}
      </p>
      <button type="button" onClick={onRetry} disabled={retrying}>
        {retrying ? 'Retrying…' : 'Try again'}
      </button>
    </div>
  )
}
