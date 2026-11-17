import { ArrowRight, History } from 'lucide-react'
import { Link } from 'react-router-dom'

import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { TableSkeleton } from '@/components/common/PageSkeleton'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { usePredictions } from '@/hooks/usePredictions'
import { errorText } from '@/services/api'

import { PredictionHistoryTable } from './PredictionHistoryTable'

interface RecentPredictionsProps {
  symbol?: string
  limit?: number
  title?: string
  emptyHint: string
}

export function RecentPredictions({
  symbol,
  limit = 5,
  title = 'Recent forecasts',
  emptyHint,
}: RecentPredictionsProps) {
  const predictions = usePredictions({ symbol, limit })
  const historyLink = symbol ? `/history?symbol=${symbol}` : '/history'

  return (
    <Card className="gap-0 p-0">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <h2 className="text-base font-semibold">{title}</h2>
        {predictions.data && predictions.data.length > 0 && (
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link to={historyLink}>
              View all
              <ArrowRight aria-hidden data-icon="inline-end" />
            </Link>
          </Button>
        )}
      </div>

      {predictions.isPending && (
        <div className="p-5">
          <TableSkeleton rows={3} />
        </div>
      )}
      {predictions.isError && (
        <div className="p-5">
          <ErrorState
            title="Could not load forecasts"
            message={errorText(predictions.error)}
            onRetry={() => void predictions.refetch()}
            retrying={predictions.isFetching}
          />
        </div>
      )}
      {predictions.data?.length === 0 && (
        <div className="p-5">
          <EmptyState
            icon={History}
            title="No forecasts yet"
            description={emptyHint}
            className="py-8"
          />
        </div>
      )}
      {predictions.data && predictions.data.length > 0 && (
        <PredictionHistoryTable rows={predictions.data} compact showSymbol={!symbol} />
      )}
    </Card>
  )
}
