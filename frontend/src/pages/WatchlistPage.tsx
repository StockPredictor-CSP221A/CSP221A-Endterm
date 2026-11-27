import { Plus, Search, SearchX, Star } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { PageHeader } from '@/components/common/PageHeader'
import { CardGridSkeleton } from '@/components/common/PageSkeleton'
import { AddStockDialog } from '@/components/stocks/AddStockDialog'
import { StockCard } from '@/components/stocks/StockCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useHistories } from '@/hooks/useStocks'
import { useWatchlist } from '@/hooks/useWatchlist'
import { errorText } from '@/services/api'
import { usePageTitle } from '@/hooks/usePageTitle'

export function WatchlistPage() {
  usePageTitle('Watchlist')
  const [query, setQuery] = useState('')
  const watchlist = useWatchlist()
  const entries = watchlist.data ?? []
  const histories = useHistories(
    entries.map((entry) => entry.symbol),
    '1mo',
  )

  const term = query.trim().toLowerCase()
  const visible = entries.flatMap((entry, index) =>
    !term ||
    entry.symbol.toLowerCase().includes(term) ||
    entry.name.toLowerCase().includes(term)
      ? [{ entry, history: histories[index] }]
      : [],
  )

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Watchlist"
        title="Your watchlist"
        description="The stocks you follow. Add any ticker, or use the star on a card to remove one."
        actions={<AddStockDialog />}
      />

      {watchlist.isPending && <CardGridSkeleton count={2} />}

      {watchlist.isError && (
        <ErrorState
          title="Could not load your watchlist"
          message={errorText(watchlist.error)}
          onRetry={() => void watchlist.refetch()}
          retrying={watchlist.isFetching}
        />
      )}

      {watchlist.data?.length === 0 && (
        <EmptyState
          icon={Star}
          title="Your watchlist is empty"
          description="Star SPY, NVDA, or KO from the dashboard, or add any other ticker you want to follow."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <AddStockDialog
                trigger={
                  <Button>
                    <Plus aria-hidden data-icon="inline-start" />
                    Add a stock
                  </Button>
                }
              />
              <Button asChild variant="outline">
                <Link to="/">Browse stocks</Link>
              </Button>
            </div>
          }
          className="py-16"
        />
      )}

      {entries.length > 0 && (
        <div className="space-y-4">
          <div className="relative max-w-sm">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter by symbol or name"
              aria-label="Filter your watchlist"
              className="h-9 pl-9"
            />
          </div>

          {visible.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title={`Nothing matches “${query.trim()}”`}
              description="Clear the filter, or add that ticker to your watchlist."
              action={
                <Button variant="outline" onClick={() => setQuery('')}>
                  Clear filter
                </Button>
              }
              className="py-12"
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visible.map(({ entry, history }) => (
                <StockCard
                  key={entry.symbol}
                  stock={entry}
                  history={history?.data}
                  isLoading={history?.isPending ?? true}
                  error={history?.error}
                  onRetry={() => void history?.refetch()}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
