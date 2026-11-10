import { useCallback, useState } from 'react'
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import { ApiError, fetchCapacity, updateWeeklyHours, type Capacity, type Person } from './api'
import { withWeeklyHours } from './capacity'

export const capacityKeys = {
  all: ['capacity'] as const,
  range: (from: string, to: string) => ['capacity', from, to] as const,
}

const weeklyHoursKey = ['weeklyHours'] as const

/**
 * Capacity for a range of weeks. While a new range loads, the previous one
 * stays available (`isPlaceholderData`) so the grid does not blank out on
 * every step. A response can only ever land under the range that asked for
 * it, and requests for a range the manager has left are cancelled.
 */
export function useCapacity(from: string, to: string) {
  return useQuery({
    queryKey: capacityKeys.range(from, to),
    queryFn: ({ signal }) => fetchCapacity(from, to, signal),
    placeholderData: keepPreviousData,
  })
}

/** What is happening to one person's weekly hours, if anything. */
export type SaveState =
  | { status: 'saving' }
  | { status: 'failed'; attempted: number; message: string }

type Edit = {
  id: number
  weeklyHours: number
  /** What to put back if the save fails. */
  previous: number
}

/**
 * Saves a person's weekly hours and keeps every loaded range honest.
 *
 * Weekly hours are one value per person, and allocated hours do not depend
 * on them. So an edit changes exactly one field, and everything else the
 * grid shows is worked out from it while rendering.
 *
 * 1. The new value goes into every cached range at once, so the grid
 *    responds immediately. Fetches already in flight are cancelled first:
 *    they were read before the save and would put the old value back.
 * 2. If the save fails, that one value is put back and the failure is kept
 *    for the row to show. Only the one field is restored, never a snapshot
 *    of the whole cache, so other saves in progress are left alone.
 * 3. If it succeeds, the value the server stored replaces the optimistic one.
 * 4. Once no save is in flight, the ranges are refetched in the background.
 *    That covers what the steps above cannot see: a range requested while
 *    the save was in the air, or a save that landed but whose reply was lost.
 */
export function useWeeklyHoursEditor() {
  const queryClient = useQueryClient()
  const [saves, setSaves] = useState<Record<number, SaveState>>({})

  const setSave = useCallback((id: number, state: SaveState | undefined) => {
    setSaves((current) => {
      const { [id]: _removed, ...rest } = current
      return state ? { ...rest, [id]: state } : rest
    })
  }, [])

  const { mutate } = useMutation({
    mutationKey: weeklyHoursKey,
    mutationFn: (edit: Edit) => updateWeeklyHours(edit.id, edit.weeklyHours),
    onMutate: async (edit) => {
      setSave(edit.id, { status: 'saving' })
      await queryClient.cancelQueries({ queryKey: capacityKeys.all })
      setCachedWeeklyHours(queryClient, edit.id, edit.weeklyHours)
    },
    onSuccess: (person: Person) => {
      setCachedWeeklyHours(queryClient, person.id, person.weeklyHours)
      setSave(person.id, undefined)
    },
    onError: (error, edit) => {
      setCachedWeeklyHours(queryClient, edit.id, edit.previous)
      setSave(edit.id, {
        status: 'failed',
        attempted: edit.weeklyHours,
        message: error instanceof ApiError ? error.message : 'Something went wrong.',
      })
    },
    onSettled: () => {
      // This save still counts as in flight here. Refetching while another
      // is pending would bring back the value that one is about to replace.
      if (queryClient.isMutating({ mutationKey: weeklyHoursKey }) === 1) {
        void queryClient.invalidateQueries({ queryKey: capacityKeys.all })
      }
    },
  })

  const save = useCallback(
    (person: Person, weeklyHours: number) =>
      mutate({ id: person.id, weeklyHours, previous: person.weeklyHours }),
    [mutate],
  )
  const dismiss = useCallback((id: number) => setSave(id, undefined), [setSave])

  return { saves, save, dismiss }
}

function setCachedWeeklyHours(queryClient: QueryClient, id: number, weeklyHours: number) {
  queryClient.setQueriesData<Capacity>(
    { queryKey: capacityKeys.all },
    (capacity) => capacity && withWeeklyHours(capacity, id, weeklyHours),
  )
}
