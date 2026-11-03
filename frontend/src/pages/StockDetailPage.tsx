import { SearchX, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { ForecastCard } from '@/components/forecast/ForecastCard'
import { RecentPredictions } from '@/components/forecast/RecentPredictions'
import { PeriodTabs } from '@/components/stock-detail/PeriodTabs'
import { StockHeader } from '@/components/stock-detail/StockHeader'
import { StockStats } from '@/components/stock-detail/StockStats'
import { PriceChart } from '@/components/stocks/PriceChart'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PERIODS, type Period } from '@/data/periods'
import { STOCKS, isStockSymbol, type StockSymbol } from '@/data/stocks'
import { useForecast } from '@/hooks/useForecast'
import { useStockHistory, useStocks } from '@/hooks/useStocks'
import { summarizeHistory } from '@/lib/history'
import { errorText } from '@/services/api'

export function StockDetailPage() {
  const { symbol } = useParams()
  const normalized = symbol?.toUpperCase()

  if (!isStockSymbol(normalized)) {
    return (
      <EmptyState
        icon={SearchX}
        title={`${symbol ?? 'This symbol'} is not supported`}
        description="This app forecasts SPY, NVDA, and KO only."
        action={
          <Button asChild>
            <Link to="/">Back to dashboard</Link>
          </Button>
        }
        className="py-20"
      />
    )
  }

  return <StockDetail key={normalized} symbol={normalized} />
}

function StockDetail({ symbol }: { symbol: StockSymbol }) {
  const [period, setPeriod] = useState<Period>('1y')
  const stocks = useStocks()
  const history = useStockHistory(symbol, period)
  const predict = useForecast(symbol)
  const [searchParams, setSearchParams] = useSearchParams()
  const autoRan = useRef(false)

  const fallback = STOCKS.find((stock) => stock.symbol === symbol)!
  const info = stocks.data?.find((stock) => stock.symbol === symbol)
  const summary = history.data ? summarizeHistory(history.data.prices) : null
  const periodLabel = PERIODS.find((item) => item.value === period)?.label ?? period
  const canForecast = summary !== null && !predict.isPending

  function runForecast() {
    if (!canForecast) return
    document.getElementById('forecast')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    predict.mutate()
  }

  // Dashboard "Run forecast" links land here with ?forecast=run.
  useEffect(() => {
    if (autoRan.current || searchParams.get('forecast') !== 'run' || !summary) return
    autoRan.current = true
    setSearchParams({}, { replace: true })
    predict.mutate()
  }, [searchParams, setSearchParams, summary, predict])

  return (
    <div className="space-y-8">
      <StockHeader
        symbol={symbol}
        name={info?.name ?? fallback.name}
        role={info?.role ?? fallback.role}
        description={info?.description}
        summary={summary}
        actions={
          <Button
            size="lg"
            className="h-10 px-4"
            onClick={runForecast}
            disabled={!canForecast}
          >
            <Sparkles aria-hidden />
            {predict.isPending ? 'Forecasting…' : 'Run forecast'}
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          <Card className="gap-4 p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Price history</h2>
                <p className="text-xs text-muted-foreground">Daily closing prices (USD)</p>
              </div>
              <PeriodTabs value={period} onChange={setPeriod} />
            </div>

            <div
              className="relative min-h-[300px] sm:min-h-[360px]"
              aria-busy={history.isFetching}
            >
              {history.isPending && <Skeleton className="h-[300px] w-full sm:h-[360px]" />}
              {history.isError && !history.data && (
                <div className="flex h-[300px] items-center sm:h-[360px]">
                  <ErrorState
                    title="Could not load prices"
                    message={errorText(history.error)}
                    onRetry={() => void history.refetch()}
                    retrying={history.isFetching}
                    className="w-full"
                  />
                </div>
              )}
              {history.data && (
                <PriceChart
                  symbol={symbol}
                  prices={history.data.prices}
                  forecast={predict.data}
                  className={history.isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}
                />
              )}
            </div>
          </Card>

          {summary ? (
            <StockStats summary={summary} periodLabel={periodLabel} />
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {Array.from({ length: 6 }, (_, index) => (
                <Skeleton key={index} className="h-[84px] rounded-xl" />
              ))}
            </div>
          )}

          <RecentPredictions
            symbol={symbol}
            title={`Your ${symbol} forecasts`}
            emptyHint={`Run a forecast and your last five ${symbol} results appear here.`}
          />
        </div>

        <aside className="space-y-6">
          <ForecastCard
            symbol={symbol}
            prediction={predict.data}
            isPending={predict.isPending}
            error={predict.error ? errorText(predict.error) : null}
            disabled={!summary}
            onRun={runForecast}
          />
        </aside>
      </div>
    </div>
  )
}
