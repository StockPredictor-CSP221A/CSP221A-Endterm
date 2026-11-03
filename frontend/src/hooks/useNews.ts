import { useQueries, useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/lib/query-keys'
import { api } from '@/services/api'

const NEWS_STALE_MS = 10 * 60 * 1000

function newsQuery(symbol: string, limit: number) {
  return {
    queryKey: queryKeys.news(symbol, limit),
    queryFn: ({ signal }: { signal: AbortSignal }) => api.news(symbol, limit, signal),
    staleTime: NEWS_STALE_MS,
    // News is optional; a failure simply hides the section.
    retry: false,
  }
}

export function useNews(symbol: string, limit = 4) {
  return useQuery(newsQuery(symbol, limit))
}

export function useNewsFor(symbols: readonly string[], limit = 4) {
  return useQueries({ queries: symbols.map((symbol) => newsQuery(symbol, limit)) })
}
