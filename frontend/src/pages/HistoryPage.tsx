import { History } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'

import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { PageHeader } from '@/components/common/PageHeader'
import { TableSkeleton } from '@/components/common/PageSkeleton'
import { PredictionHistoryTable } from '@/components/forecast/PredictionHistoryTable'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { STOCK_SYMBOLS, isStockSymbol } from '@/data/stocks'
import { usePredictions } from '@/hooks/usePredictions'
import { errorText } from '@/services/api'

const ALL = 'all'
const LIMIT = 100

export function HistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const param = searchParams.get('symbol')?.toUpperCase()
  const symbol = isStockSymbol(param) ? param : undefined
  const predictions = usePredictions({ symbol, limit: LIMIT })

  function setFilter(value: string) {
    setSearchParams(value === ALL ? {} : { symbol: value }, { replace: true })
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="History"
        title="Forecast history"
        description={`Every forecast you have run, newest first. Showing up to ${LIMIT}.`}
      />

      <Card className="gap-0 p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <Tabs value={symbol ?? ALL} onValueChange={setFilter}>
            <TabsList aria-label="Filter by symbol" className="h-9">
              <TabsTrigger value={ALL} className="px-3 text-xs data-[state=active]:text-brand">
                All
              </TabsTrigger>
              {STOCK_SYMBOLS.map((item) => (
                <TabsTrigger
                  key={item}
                  value={item}
                  className="px-3 text-xs data-[state=active]:text-brand"
                >
                  {item}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {predictions.data && (
            <p className="text-xs text-muted-foreground tabular-nums">
              {predictions.data.length} {predictions.data.length === 1 ? 'forecast' : 'forecasts'}
            </p>
          )}
        </div>

        {predictions.isPending && (
          <div className="p-5">
            <TableSkeleton rows={6} />
          </div>
        )}
        {predictions.isError && (
          <div className="p-5">
            <ErrorState
              title="Could not load your forecasts"
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
              title={symbol ? `No ${symbol} forecasts yet` : 'No forecasts yet'}
              description="Run a forecast from a stock page and it will show up here."
              action={
                <Button asChild>
                  <Link to={symbol ? `/stocks/${symbol}` : '/'}>
                    {symbol ? `Open ${symbol}` : 'Go to dashboard'}
                  </Link>
                </Button>
              }
            />
          </div>
        )}
        {predictions.data && predictions.data.length > 0 && (
          <PredictionHistoryTable rows={predictions.data} />
        )}
      </Card>
    </div>
  )
}
