import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { STOCKS, STOCK_SYMBOLS } from '@/data/stocks'
import { queryKeys } from '@/lib/query-keys'
import { api, errorText } from '@/services/api'
import type { StockInfo, WatchlistEntry } from '@/types'

export function useWatchlist() {
  return useQuery({
    queryKey: queryKeys.watchlist,
    queryFn: ({ signal }) => api.watchlist.list(signal),
    staleTime: 60 * 1000,
  })
}

export function useIsWatched(symbol: string): boolean {
  const watchlist = useWatchlist()
  return watchlist.data?.some((entry) => entry.symbol === symbol) ?? false
}

interface ToggleVariables {
  symbol: string
  watch: boolean
}

interface ToggleContext {
  previous: WatchlistEntry[] | undefined
}

function optimisticEntry(symbol: string, stocks: StockInfo[] | undefined): WatchlistEntry {
  const info = stocks?.find((stock) => stock.symbol === symbol)
  const fallback = STOCKS.find((stock) => stock.symbol === symbol)
  return {
    symbol,
    name: info?.name ?? fallback?.name ?? symbol,
    role: info?.role ?? fallback?.role ?? 'Safe',
    description: info?.description ?? '',
    added_at: new Date().toISOString(),
  }
}

function universeIndex(symbol: string): number {
  return STOCK_SYMBOLS.findIndex((item) => item === symbol)
}

function sortByUniverse(entries: WatchlistEntry[]): WatchlistEntry[] {
  return [...entries].sort((a, b) => universeIndex(a.symbol) - universeIndex(b.symbol))
}

/** Adds or removes a symbol, updating the cached list immediately and rolling back on failure. */
export function useToggleWatchlist() {
  const queryClient = useQueryClient()

  return useMutation<void, Error, ToggleVariables, ToggleContext>({
    mutationFn: async ({ symbol, watch }) => {
      if (watch) await api.watchlist.add(symbol)
      else await api.watchlist.remove(symbol)
    },
    onMutate: async ({ symbol, watch }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.watchlist })
      const previous = queryClient.getQueryData<WatchlistEntry[]>(queryKeys.watchlist)
      const stocks = queryClient.getQueryData<StockInfo[]>(queryKeys.stocks)
      const current = (previous ?? []).filter((entry) => entry.symbol !== symbol)
      queryClient.setQueryData<WatchlistEntry[]>(
        queryKeys.watchlist,
        watch ? sortByUniverse([...current, optimisticEntry(symbol, stocks)]) : current,
      )
      return { previous }
    },
    onSuccess: (_data, { symbol, watch }) => {
      toast.success(watch ? `${symbol} added to your watchlist` : `${symbol} removed from your watchlist`)
    },
    onError: (error, { symbol, watch }, context) => {
      queryClient.setQueryData(queryKeys.watchlist, context?.previous)
      toast.error(`Could not ${watch ? 'add' : 'remove'} ${symbol}`, {
        description: errorText(error),
      })
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.watchlist }),
  })
}
