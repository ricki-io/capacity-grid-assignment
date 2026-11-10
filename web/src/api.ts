export type Person = {
  id: number
  name: string
  weeklyHours: number
}

export type PersonCapacity = Person & {
  /** Hours booked per week, lined up with `Capacity.weeks`. */
  allocated: number[]
}

export type Capacity = {
  /** The Monday of every week in the range, as YYYY-MM-DD. */
  weeks: string[]
  people: PersonCapacity[]
}

/** A failure with a message that is safe to show to the manager. */
export class ApiError extends Error {}

export function fetchCapacity(from: string, to: string, signal?: AbortSignal): Promise<Capacity> {
  const params = new URLSearchParams({ from, to })
  return request<Capacity>(`/api/capacity?${params}`, { signal })
}

export function updateWeeklyHours(id: number, weeklyHours: number): Promise<Person> {
  return request<Person>(`/api/people/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ weeklyHours }),
  })
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, init)
  } catch (cause) {
    // A cancelled request is not a failure; let the caller see the abort.
    if (init?.signal?.aborted) throw cause
    throw new ApiError('Could not reach the server.')
  }

  if (!response.ok) {
    const body: { error?: string } | null = await response.json().catch(() => null)
    throw new ApiError(body?.error ?? 'The server had a problem.')
  }
  return response.json()
}
