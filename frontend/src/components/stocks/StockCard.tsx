import { ArrowRight, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

import { DeltaBadge } from '@/components/common/DeltaBadge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { errorText } from '@/services/api'
import { formatCurrency, formatShortDate } from '@/lib/format'
import { summarizeHistory } from '@/lib/history'
import type { StockHistory, StockInfo } from '@/types'

import { RoleBadge } from './RoleBadge'
import { Sparkline } from './Sparkline'

interface StockCardProps {
  stock: StockInfo
  history: StockHistory | undefined
  isLoading: boolean
  error: unknown
  onRetry: () => void
}

export function StockCard({ stock, history, isLoading, error, onRetry }: StockCardProps) {
  const summary = history ? summarizeHistory(history.prices) : null
  const detailPath = `/stocks/${stock.symbol}`

  return (
    <Card className="gap-0 p-0 transition-colors hover:ring-foreground/20">
      <div className="flex items-start justify-between gap-3 p-5 pb-0">
        <Link
          to={detailPath}
          className="min-w-0 rounded-md outline-none hover:text-brand focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="block text-lg font-semibold tracking-tight">{stock.symbol}</span>
          <span className="block truncate text-xs text-muted-foreground">{stock.name}</span>
        </Link>
        <RoleBadge role={stock.role} />
      </div>

      <div className="min-h-[148px] px-5 pt-5">
        {isLoading && (
          <div className="space-y-3" aria-label={`Loading ${stock.symbol}`}>
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}

        {!isLoading && (error || !summary) && (
          <div className="flex h-[132px] flex-col items-start justify-center gap-2">
            <p className="text-sm text-muted-foreground">
              {error ? errorText(error, 'Prices unavailable') : 'No recent prices'}
            </p>
            <Button variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
          </div>
        )}

        {!isLoading && !error && summary && history && (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-3xl font-semibold tracking-tight tabular-nums">
                {formatCurrency(summary.last.close)}
              </p>
              {summary.dailyChangePercent !== null && (
                <DeltaBadge percent={summary.dailyChangePercent} size="md" />
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Last close · {formatShortDate(summary.last.date)} · 1M trend
            </p>
            <Sparkline prices={history.prices} className="mt-3" />
          </>
        )}
      </div>

      <div className="mt-4 flex gap-2 border-t border-border p-4">
        <Button asChild variant="outline" className="h-9 flex-1">
          <Link to={detailPath}>
            View details
            <ArrowRight aria-hidden data-icon="inline-end" />
          </Link>
        </Button>
        <Button asChild variant="secondary" className="h-9 flex-1">
          <Link to={`${detailPath}?forecast=run`}>
            <Sparkles aria-hidden data-icon="inline-start" className="text-brand" />
            Run forecast
          </Link>
        </Button>
      </div>
    </Card>
  )
}
