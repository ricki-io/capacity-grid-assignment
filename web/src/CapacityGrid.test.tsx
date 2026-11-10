import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Capacity } from './api'
import { CapacityGrid } from './CapacityGrid'

// One week, two people: Dee is 5h over, Ana is exactly full.
function capacityWith(deeWeeklyHours: number): Capacity {
  return {
    weeks: ['2026-01-05'],
    people: [
      { id: 1, name: 'Ana Ferreira', weeklyHours: 40, allocated: [40] },
      { id: 4, name: 'Dee Okafor', weeklyHours: deeWeeklyHours, allocated: [45] },
    ],
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

/**
 * Stands in for the API. `stored` is what the database holds; the PATCH
 * reply is handed back so each test decides when, and how, the save ends.
 * While `down`, reads fail too, as they do when the API really is down.
 */
function fakeApi() {
  let stored = 40
  let down = false
  let finishSave: (response: Response) => void = () => {}

  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        return new Promise<Response>((resolve) => {
          finishSave = resolve
        })
      }
      return Promise.resolve(
        down ? json({ error: 'The database is down.' }, 500) : json(capacityWith(stored)),
      )
    }),
  )

  return {
    goesDown() {
      down = true
    },
    comesBack() {
      down = false
    },
    saveSucceeds(weeklyHours: number) {
      stored = weeklyHours
      finishSave(json({ id: 4, name: 'Dee Okafor', weeklyHours }))
    },
    saveFails() {
      finishSave(json({ error: 'The database is down.' }, 500))
    },
  }
}

async function renderGrid() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <CapacityGrid from="2026-01-05" to="2026-01-11" />
    </QueryClientProvider>,
  )
  await screen.findByText('Dee Okafor')
}

function changeDeeWeeklyHoursTo(hours: string) {
  fireEvent.click(screen.getByRole('button', { name: /Edit weekly hours for Dee Okafor/ }))
  const input = screen.getByRole('spinbutton', { name: 'Weekly hours for Dee Okafor' })
  fireEvent.change(input, { target: { value: hours } })
  fireEvent.keyDown(input, { key: 'Enter' })
}

function summary() {
  return document.querySelector('.capacity-summary')?.textContent
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('editing weekly hours', () => {
  it('updates every number that depends on them, before and after the save lands', async () => {
    const api = fakeApi()
    await renderGrid()
    expect(screen.getByText('+5h over')).toBeInTheDocument()
    expect(screen.getByText('1 over')).toBeInTheDocument()
    expect(summary()).toContain('1 of 2 people')

    changeDeeWeeklyHoursTo('50')

    // Still saving: the grid already shows the new picture.
    await waitFor(() => expect(screen.queryByText('+5h over')).not.toBeInTheDocument())
    expect(screen.getByText('Saving…')).toBeInTheDocument()
    expect(screen.getByText('none over')).toBeInTheDocument()
    expect(summary()).toContain('0 of 2 people')

    api.saveSucceeds(50)

    await waitFor(() => expect(screen.queryByText('Saving…')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Dee Okafor, now 50h/ })).toBeInTheDocument()
    expect(screen.queryByText('+5h over')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('puts the old hours back when the save fails, and says what was not saved', async () => {
    const api = fakeApi()
    await renderGrid()

    changeDeeWeeklyHoursTo('50')
    await waitFor(() => expect(screen.queryByText('+5h over')).not.toBeInTheDocument())

    // The refetch that follows a save fails as well, so nothing but the
    // rollback can put the old hours back.
    api.goesDown()
    api.saveFails()

    expect(await screen.findByText(/Could not save 50h\. The database is down\./)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Dee Okafor, now 40h/ })).toBeInTheDocument()
    expect(screen.getByText('+5h over')).toBeInTheDocument()
    expect(screen.getByText('1 over')).toBeInTheDocument()
    expect(summary()).toContain('1 of 2 people')

    // The failure offers the same value again, so it is not retyped.
    api.comesBack()
    const failure = screen.getByText(/Could not save 50h/)
    fireEvent.click(within(failure).getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(screen.queryByText('+5h over')).not.toBeInTheDocument())
    api.saveSucceeds(50)
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Dee Okafor, now 50h/ })).toBeInTheDocument()
  })
})
