import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/lib/query-keys'
import { api } from '@/services/api'

export function useStocks() {
  return useQuery({
    queryKey: queryKeys.stocks,
    queryFn: ({ signal }) => api.stocks(signal),
    staleTime: Infinity,
  })
}

export function historyQuery(symbol: string, period: string) {
  return {
    queryKey: queryKeys.history(symbol, period),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      api.history(symbol, period, signal),
  }
}

/** Keeps the previous period on screen while the next one loads. */
export function useStockHistory(symbol: string, period: string) {
  return useQuery({ ...historyQuery(symbol, period), placeholderData: keepPreviousData })
}

export function useHistories(symbols: readonly string[], period: string) {
  return useQueries({
    queries: symbols.map((symbol) => historyQuery(symbol, period)),
  })
}
