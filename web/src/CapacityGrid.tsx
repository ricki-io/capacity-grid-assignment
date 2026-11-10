import { memo, useMemo, useState } from 'react'
import type { Person, PersonCapacity } from './api'
import { formatHours, isOverInAnyWeek, loadOf, overCountByWeek } from './capacity'
import { FilterIcon } from './icons'
import { useCapacity, useWeeklyHoursEditor, type SaveState } from './useCapacity'
import { addDays, formatDay, mondayOf, today } from './weeks'
import { WeeklyHoursEditor } from './WeeklyHoursEditor'

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
  const { saves, save, dismiss } = useWeeklyHoursEditor()
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
          <strong className={overPeople.length > 0 ? 'some-over' : undefined}>
            {overPeople.length}
          </strong>{' '}
          of {data.people.length} people are over-allocated in these weeks
        </p>
        {/* Still a checkbox to assistive technology; drawn as a filter button. */}
        <label className="filter-toggle">
          <input
            type="checkbox"
            checked={onlyOver}
            onChange={(event) => setOnlyOver(event.target.checked)}
          />
          <FilterIcon />
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
          <table className="grid" aria-label="Allocated hours per person, week by week">
            <thead>
              <tr>
                <th scope="col" className="person-col">
                  People <span className="people-count">{people.length}</span>
                </th>
                {data.weeks.map((week, index) => (
                  <th
                    scope="col"
                    key={week}
                    className={week === thisWeek ? 'week-col this-week' : 'week-col'}
                  >
                    <span className="week-label">
                      {/* The purple marker says this to the eye; this says it to a screen reader. */}
                      {week === thisWeek && <span className="visually-hidden">This week, </span>}
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
                <PersonRow
                  key={person.id}
                  person={person}
                  save={saves[person.id]}
                  onSave={save}
                  onDismiss={dismiss}
                />
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
const PersonRow = memo(function PersonRow({
  person,
  save,
  onSave,
  onDismiss,
}: {
  person: PersonCapacity
  save: SaveState | undefined
  onSave: (person: Person, weeklyHours: number) => void
  onDismiss: (id: number) => void
}) {
  return (
    <tr>
      <th scope="row" className="person-col">
        <div className="person">
          <span className="avatar" aria-hidden="true">
            {initialsOf(person.name)}
          </span>
          <div className="person-detail">
            {/* bdi keeps right-to-left names from reordering the text around them */}
            {/* title: long names are cut off with an ellipsis */}
            <bdi className="person-name" title={person.name}>
              {person.name}
            </bdi>
            <WeeklyHoursEditor person={person} save={save} onSave={onSave} onDismiss={onDismiss} />
          </div>
        </div>
      </th>
      {person.allocated.map((allocated, week) => (
        <WeekCell key={week} allocated={allocated} capacity={person.weeklyHours} />
      ))}
    </tr>
  )
})

/** Up to two letters for the avatar: first and last name, or the start of a single name. */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  // Array.from splits by code point, so letters outside the basic plane stay whole.
  const letters =
    words.length > 1
      ? [Array.from(words[0])[0], Array.from(words[words.length - 1])[0]]
      : Array.from(words[0] ?? '').slice(0, 2)
  return letters.join('').toUpperCase()
}

function WeekCell({ allocated, capacity }: { allocated: number; capacity: number }) {
  const load = loadOf(allocated, capacity)
  if (load === 'none') {
    return (
      <td className="cell cell-none">
        <span aria-hidden="true">–</span>
        <span className="visually-hidden">Nothing allocated</span>
      </td>
    )
  }

  const filled = capacity > 0 ? Math.min(allocated / capacity, 1) : 1
  return (
    <td className={`cell cell-${load}`}>
      {/* The space keeps "40h" and "full" apart when read aloud. */}
      <span className="cell-hours">{formatHours(allocated)}</span>{' '}
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
      <button type="button" className="button-primary" onClick={onRetry} disabled={retrying}>
        {retrying ? 'Retrying…' : 'Try again'}
      </button>
    </div>
  )
}
