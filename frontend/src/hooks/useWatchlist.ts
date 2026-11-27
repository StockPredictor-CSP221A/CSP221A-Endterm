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

/** The cached watchlist entry for a symbol, if the user watches it. */
export function useWatchlistEntry(symbol: string): WatchlistEntry | undefined {
  const watchlist = useWatchlist()
  return watchlist.data?.find((entry) => entry.symbol === symbol)
}

interface ToggleVariables {
  symbol: string
  watch: boolean
}

interface ToggleContext {
  previous: WatchlistEntry[] | undefined
}

function optimisticEntry(
  symbol: string,
  stocks: StockInfo[] | undefined,
  previous: WatchlistEntry | undefined,
): WatchlistEntry {
  if (previous) return previous
  const info = stocks?.find((stock) => stock.symbol === symbol)
  const fallback = STOCKS.find((stock) => stock.symbol === symbol)
  const isDefault = fallback !== undefined
  return {
    symbol,
    name: info?.name ?? fallback?.name ?? symbol,
    role: info?.role ?? fallback?.role ?? 'Custom',
    description: info?.description ?? '',
    added_at: new Date().toISOString(),
    is_default: isDefault,
  }
}

function universeIndex(symbol: string): number {
  return STOCK_SYMBOLS.findIndex((item) => item === symbol)
}

/** Same order as the API: the default three first, then added stocks oldest first. */
function sortWatchlist(entries: WatchlistEntry[]): WatchlistEntry[] {
  const defaults = entries
    .filter((entry) => entry.is_default)
    .sort((a, b) => universeIndex(a.symbol) - universeIndex(b.symbol))
  const custom = entries
    .filter((entry) => !entry.is_default)
    .sort((a, b) => a.added_at.localeCompare(b.added_at))
  return [...defaults, ...custom]
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
      const existing = previous?.find((entry) => entry.symbol === symbol)
      const current = (previous ?? []).filter((entry) => entry.symbol !== symbol)
      queryClient.setQueryData<WatchlistEntry[]>(
        queryKeys.watchlist,
        watch ? sortWatchlist([...current, optimisticEntry(symbol, stocks, existing)]) : current,
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

/**
 * Adds any ticker. Not optimistic: the server checks the ticker has market data
 * and looks up its name, so callers show its error inline instead of a toast.
 */
export function useAddStock() {
  const queryClient = useQueryClient()

  return useMutation<WatchlistEntry, Error, string>({
    mutationFn: (symbol) => api.watchlist.add(symbol),
    onSuccess: (entry) => {
      queryClient.setQueryData<WatchlistEntry[]>(queryKeys.watchlist, (previous) =>
        sortWatchlist([
          ...(previous ?? []).filter((item) => item.symbol !== entry.symbol),
          entry,
        ]),
      )
      toast.success(`${entry.symbol} added to your watchlist`, {
        description: entry.name !== entry.symbol ? entry.name : undefined,
      })
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.watchlist }),
  })
}
