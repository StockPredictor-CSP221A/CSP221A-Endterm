import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/lib/query-keys'
import { api } from '@/services/api'

export function usePredictions({ symbol, limit = 20 }: { symbol?: string; limit?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.predictionList(symbol, limit),
    queryFn: ({ signal }) => api.predictions({ symbol, limit }, signal),
    staleTime: 30 * 1000,
  })
}
