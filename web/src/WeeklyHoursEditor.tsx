import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { Person } from './api'
import { MAX_WEEKLY_HOURS, formatHours } from './capacity'
import { PencilIcon } from './icons'
import type { SaveState } from './useCapacity'

type Props = {
  person: Person
  save: SaveState | undefined
  onSave: (person: Person, weeklyHours: number) => void
  onDismiss: (id: number) => void
}

// WeeklyHoursEditor shows a person's weekly hours and lets a manager change
// them in place. Enter or leaving the field saves, Escape cancels. A failed
// save stays on the row, with the value that was tried, until it is retried
// or dismissed.
export function WeeklyHoursEditor({ person, save, onSave, onDismiss }: Props) {
  const [draft, setDraft] = useState<string | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef(false)

  const editing = draft !== null
  const saving = save?.status === 'saving'
  const failed = save?.status === 'failed' ? save : undefined
  const hours = editing ? parseHours(draft) : null

  // Closing with the keyboard puts focus back where the edit started.
  useEffect(() => {
    if (!editing && returnFocus.current) {
      returnFocus.current = false
      button.current?.focus()
    }
  }, [editing])

  function commit() {
    if (hours === null) return
    setDraft(null)
    if (hours !== person.weeklyHours) onSave(person, hours)
    else if (failed) onDismiss(person.id)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' && hours !== null) {
      returnFocus.current = true
      commit()
    }
    if (event.key === 'Escape') {
      returnFocus.current = true
      setDraft(null)
    }
  }

  if (editing) {
    return (
      <span className="hours-editor">
        <input
          className="hours-input"
          type="number"
          inputMode="decimal"
          min={0}
          max={MAX_WEEKLY_HOURS}
          step="any"
          autoFocus
          value={draft}
          aria-label={`Weekly hours for ${person.name}`}
          aria-invalid={hours === null}
          onFocus={(event) => event.target.select()}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          // Leaving the field saves a valid value and drops an invalid one.
          // Enter and Escape have already closed it by the time it blurs.
          onBlur={() => {
            if (returnFocus.current) return
            if (hours === null) setDraft(null)
            else commit()
          }}
        />
        <span className="hours-unit">h / week</span>
        {hours === null && (
          <span className="hours-problem" role="alert">
            Enter hours from 0 to {MAX_WEEKLY_HOURS}
          </span>
        )}
      </span>
    )
  }

  return (
    <span className="hours-editor">
      <button
        ref={button}
        type="button"
        className="hours-button"
        // Not `disabled`: a disabled button cannot hold the focus that
        // returns to it after Enter, and the save starts in that same moment.
        aria-disabled={saving}
        aria-label={`Edit weekly hours for ${person.name}, now ${formatHours(person.weeklyHours)}`}
        onClick={() => {
          // One save per person at a time, so replies cannot arrive out of order.
          if (saving) return
          // A new attempt starts from the value that failed, so it is not retyped.
          setDraft(String(failed ? failed.attempted : person.weeklyHours))
        }}
      >
        {formatHours(person.weeklyHours)} / week
        <PencilIcon />
      </button>
      {saving && (
        <span className="hours-saving" role="status">
          Saving…
        </span>
      )}
      {failed && (
        <span className="hours-problem" role="alert">
          Could not save {formatHours(failed.attempted)}. {failed.message}{' '}
          <button type="button" onClick={() => onSave(person, failed.attempted)}>
            Try again
          </button>{' '}
          <button type="button" onClick={() => onDismiss(person.id)}>
            Dismiss
          </button>
        </span>
      )}
    </span>
  )
}

/** The hours typed, or null when they are not a valid amount. */
function parseHours(text: string): number | null {
  if (text.trim() === '') return null
  const hours = Number(text)
  return Number.isFinite(hours) && hours >= 0 && hours <= MAX_WEEKLY_HOURS ? hours : null
}
