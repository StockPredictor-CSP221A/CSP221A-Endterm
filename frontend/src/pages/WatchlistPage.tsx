import { Star } from 'lucide-react'
import { Link } from 'react-router-dom'

import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { PageHeader } from '@/components/common/PageHeader'
import { CardGridSkeleton } from '@/components/common/PageSkeleton'
import { StockCard } from '@/components/stocks/StockCard'
import { Button } from '@/components/ui/button'
import { useHistories } from '@/hooks/useStocks'
import { useWatchlist } from '@/hooks/useWatchlist'
import { errorText } from '@/services/api'

export function WatchlistPage() {
  const watchlist = useWatchlist()
  const entries = watchlist.data ?? []
  const histories = useHistories(
    entries.map((entry) => entry.symbol),
    '1mo',
  )

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Watchlist"
        title="Your watchlist"
        description="The stocks you follow. Use the star on any card to add or remove one."
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
          description="Star SPY, NVDA, or KO from the dashboard or a stock page to keep it here. You can also press ⌘K to jump to a stock."
          action={
            <Button asChild>
              <Link to="/">Browse stocks</Link>
            </Button>
          }
          className="py-16"
        />
      )}

      {entries.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {entries.map((entry, index) => {
            const history = histories[index]
            return (
              <StockCard
                key={entry.symbol}
                stock={entry}
                history={history?.data}
                isLoading={history?.isPending ?? true}
                error={history?.error}
                onRetry={() => void history?.refetch()}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
