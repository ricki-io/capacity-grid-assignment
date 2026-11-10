import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { fetchCapacity } from './api'

export const capacityKeys = {
  all: ['capacity'] as const,
  range: (from: string, to: string) => ['capacity', from, to] as const,
}

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
