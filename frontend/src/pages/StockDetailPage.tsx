import { Plus, SearchX, Sparkles, Star } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { PageSkeleton } from '@/components/common/PageSkeleton'
import { ForecastCard } from '@/components/forecast/ForecastCard'
import { RecentPredictions } from '@/components/forecast/RecentPredictions'
import { StockNews } from '@/components/news/StockNews'
import { PeriodTabs } from '@/components/stock-detail/PeriodTabs'
import { StockHeader } from '@/components/stock-detail/StockHeader'
import { StockStats } from '@/components/stock-detail/StockStats'
import { PriceChart } from '@/components/stocks/PriceChart'
import { WatchlistButton } from '@/components/stocks/WatchlistButton'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PERIODS, type Period } from '@/data/periods'
import { STOCKS, isStockSymbol, normalizeTicker } from '@/data/stocks'
import { useForecast } from '@/hooks/useForecast'
import { useStockHistory, useStocks } from '@/hooks/useStocks'
import { useAddStock, useWatchlist } from '@/hooks/useWatchlist'
import { summarizeHistory } from '@/lib/history'
import { errorText } from '@/services/api'
import { usePageTitle } from '@/hooks/usePageTitle'
import type { StockInfo } from '@/types'

export function StockDetailPage() {
  const { symbol } = useParams()
  const normalized = normalizeTicker(symbol)
  const watchlist = useWatchlist()
  const entry = watchlist.data?.find((item) => item.symbol === normalized)
  usePageTitle(normalized ?? 'Unknown symbol')

  if (!normalized) {
    return (
      <EmptyState
        icon={SearchX}
        title={`${symbol ?? 'This'} is not a valid ticker`}
        description="Tickers are 1–10 letters, digits, dots, or dashes, like AAPL or BRK-B."
        action={
          <Button asChild>
            <Link to="/">Back to dashboard</Link>
          </Button>
        }
        className="py-20"
      />
    )
  }

  if (isStockSymbol(normalized)) {
    const fallback = STOCKS.find((stock) => stock.symbol === normalized)!
    return <StockDetail key={normalized} symbol={normalized} fallback={fallback} />
  }

  // Added tickers are only served once they are on the user's watchlist.
  if (watchlist.isPending) return <PageSkeleton />
  if (watchlist.isError) {
    return (
      <ErrorState
        title="Could not load your watchlist"
        message={errorText(watchlist.error)}
        onRetry={() => void watchlist.refetch()}
        retrying={watchlist.isFetching}
      />
    )
  }
  if (!entry) return <NotWatched key={normalized} symbol={normalized} />

  return <StockDetail key={normalized} symbol={normalized} fallback={entry} />
}

function NotWatched({ symbol }: { symbol: string }) {
  const addStock = useAddStock()

  return (
    <EmptyState
      icon={Star}
      title={`${symbol} is not on your watchlist`}
      description={
        addStock.error
          ? errorText(addStock.error)
          : `Add ${symbol} to your watchlist to see its prices and news and run forecasts.`
      }
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => addStock.mutate(symbol)} disabled={addStock.isPending}>
            <Plus aria-hidden data-icon="inline-start" />
            {addStock.isPending ? 'Checking ticker…' : `Add ${symbol}`}
          </Button>
          <Button asChild variant="outline">
            <Link to="/">Back to dashboard</Link>
          </Button>
        </div>
      }
      className="py-20"
    />
  )
}

interface StockDetailProps {
  symbol: string
  /** Name and role to show before /stocks loads, or for added tickers. */
  fallback: Pick<StockInfo, 'name' | 'role'> & { description?: string }
}

function StockDetail({ symbol, fallback }: StockDetailProps) {
  const [period, setPeriod] = useState<Period>('1y')
  const stocks = useStocks()
  const history = useStockHistory(symbol, period)
  const predict = useForecast(symbol)
  const [searchParams, setSearchParams] = useSearchParams()
  const autoRan = useRef(false)

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
        description={info?.description ?? fallback.description}
        summary={summary}
        actions={
          <>
          <WatchlistButton symbol={symbol} variant="full" />
          <Button
            size="lg"
            className="h-10 px-4"
            onClick={runForecast}
            disabled={!canForecast}
          >
            <Sparkles aria-hidden />
            {predict.isPending ? 'Forecasting…' : 'Run forecast'}
          </Button>
          </>
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

      <StockNews symbol={symbol} />
    </div>
  )
}
