import { MarketSnapshot } from '@/components/dashboard/MarketSnapshot'
import { WatchlistPanel } from '@/components/dashboard/WatchlistPanel'
import { ErrorState } from '@/components/common/ErrorState'
import { CardGridSkeleton } from '@/components/common/PageSkeleton'
import { RecentPredictions } from '@/components/forecast/RecentPredictions'
import { ModelPerformanceCard } from '@/components/ModelPerformanceCard'
import { StockCard } from '@/components/stocks/StockCard'
import { useAuth } from '@/hooks/useAuth'
import { useHistories, useStocks } from '@/hooks/useStocks'
import { summarizeHistory } from '@/lib/history'
import { errorText } from '@/services/api'

const SPARKLINE_PERIOD = '1mo'

function greeting(date = new Date()): string {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export function DashboardPage() {
  const { user } = useAuth()
  const stocks = useStocks()
  const symbols = stocks.data?.map((stock) => stock.symbol) ?? []
  const histories = useHistories(symbols, SPARKLINE_PERIOD)

  const name = user?.display_name ?? user?.email
  const snapshotRows = (stocks.data ?? []).flatMap((stock, index) => {
    const prices = histories[index]?.data?.prices
    const summary = prices ? summarizeHistory(prices) : null
    return summary ? [{ symbol: stock.symbol, summary }] : []
  })
  const summaries = Object.fromEntries(snapshotRows.map((row) => [row.symbol, row.summary]))

  return (
    <div className="space-y-8">
      <div>
        <p className="label-caps">Dashboard</p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-3xl">
          {greeting()}
          {name ? <span className="text-muted-foreground">, {name}</span> : null}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Daily closes and next-day forecasts for SPY, NVDA, and KO.
        </p>
      </div>

      <MarketSnapshot
        rows={snapshotRows}
        isLoading={stocks.isPending || histories.some((query) => query.isPending)}
      />

      <section aria-labelledby="stocks-heading" className="space-y-4">
        <h2 id="stocks-heading" className="text-lg font-semibold">
          Stocks
        </h2>
        {stocks.isPending && <CardGridSkeleton />}
        {stocks.isError && (
          <ErrorState
            title="Could not load stocks"
            message={errorText(stocks.error)}
            onRetry={() => void stocks.refetch()}
            retrying={stocks.isFetching}
          />
        )}
        {stocks.data && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {stocks.data.map((stock, index) => {
              const history = histories[index]
              return (
                <StockCard
                  key={stock.symbol}
                  stock={stock}
                  history={history?.data}
                  isLoading={history?.isPending ?? true}
                  error={history?.error}
                  onRetry={() => void history?.refetch()}
                />
              )
            })}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <RecentPredictions emptyHint="Run a forecast on any stock card above. Your last five appear here." />
        </div>
        <WatchlistPanel summaries={summaries} />
      </div>

      <ModelPerformanceCard />
    </div>
  )
}
