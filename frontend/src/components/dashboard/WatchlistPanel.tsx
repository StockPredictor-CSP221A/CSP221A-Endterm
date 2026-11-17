import { ArrowRight, Star } from 'lucide-react'
import { Link } from 'react-router-dom'

import { DeltaBadge } from '@/components/common/DeltaBadge'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { TableSkeleton } from '@/components/common/PageSkeleton'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useWatchlist } from '@/hooks/useWatchlist'
import { formatCurrency } from '@/lib/format'
import type { HistorySummary } from '@/lib/history'
import { errorText } from '@/services/api'

interface WatchlistPanelProps {
  /** Latest summaries keyed by symbol, shared with the dashboard cards. */
  summaries: Record<string, HistorySummary | undefined>
}

export function WatchlistPanel({ summaries }: WatchlistPanelProps) {
  const watchlist = useWatchlist()

  return (
    <Card className="gap-0 p-0">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <h2 className="text-base font-semibold">Watchlist</h2>
        {watchlist.data && watchlist.data.length > 0 && (
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link to="/watchlist">
              Open
              <ArrowRight aria-hidden data-icon="inline-end" />
            </Link>
          </Button>
        )}
      </div>

      {watchlist.isPending && (
        <div className="p-5">
          <TableSkeleton rows={2} />
        </div>
      )}
      {watchlist.isError && (
        <div className="p-5">
          <ErrorState
            title="Could not load your watchlist"
            message={errorText(watchlist.error)}
            onRetry={() => void watchlist.refetch()}
            retrying={watchlist.isFetching}
          />
        </div>
      )}
      {watchlist.data?.length === 0 && (
        <div className="p-5">
          <EmptyState
            icon={Star}
            title="Nothing starred yet"
            description="Use the star on a stock card to follow it here."
            className="py-8"
          />
        </div>
      )}
      {watchlist.data && watchlist.data.length > 0 && (
        <ul className="divide-y divide-border">
          {watchlist.data.map((entry) => {
            const summary = summaries[entry.symbol]
            return (
              <li key={entry.symbol}>
                <Link
                  to={`/stocks/${entry.symbol}`}
                  className="flex items-center justify-between gap-3 px-5 py-3.5 outline-none transition-colors hover:bg-surface/60 focus-visible:bg-surface/60"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{entry.symbol}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {entry.name}
                    </span>
                  </span>
                  {summary && (
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-sm font-medium tabular-nums">
                        {formatCurrency(summary.last.close)}
                      </span>
                      {summary.dailyChangePercent !== null && (
                        <DeltaBadge percent={summary.dailyChangePercent} />
                      )}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
