import { useEffect, useRef, useState } from 'react'

import { EvaluationPanel } from '@/components/legacy/EvaluationPanel'
import { HistoryChart } from '@/components/legacy/HistoryChart'
import { PeriodSelector } from '@/components/legacy/PeriodSelector'
import { PredictionPanel } from '@/components/legacy/PredictionPanel'
import { StockSelector } from '@/components/legacy/StockSelector'
import { type Period } from '@/data/periods'
import { STOCKS, type StockSymbol } from '@/data/stocks'
import { formatCurrency, formatDate } from '@/lib/format'
import { api } from '@/services/api'
import type { Prediction, StockHistory } from '@/types'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold">{value}</dd>
    </div>
  )
}

function HistorySkeleton() {
  return (
    <div className="mt-5 space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="h-16 animate-pulse rounded-xl bg-surface"
          />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-xl bg-surface" />
    </div>
  )
}

export function DashboardPage() {
  const [selected, setSelected] = useState<StockSymbol>('SPY')
  const [period, setPeriod] = useState<Period>('1y')
  const [history, setHistory] = useState<StockHistory | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [prediction, setPrediction] = useState<Prediction | null>(null)
  const [predicting, setPredicting] = useState(false)
  const [predictError, setPredictError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const predictRequest = useRef(0)

  const stock = STOCKS.find((item) => item.symbol === selected) ?? STOCKS[0]

  useEffect(() => {
    let cancelled = false

    api
      .history(selected, period)
      .then((data) => {
        if (!cancelled) setHistory(data)
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setHistory(null)
          setHistoryError(error.message)
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false)
      })

    return () => {
      cancelled = true
    }
  }, [selected, period, reloadKey])

  function handleSelect(symbol: StockSymbol) {
    if (symbol === selected) return
    predictRequest.current += 1
    setSelected(symbol)
    setPrediction(null)
    setPredictError(null)
    setPredicting(false)
    setHistory(null)
    setHistoryError(null)
    setLoadingHistory(true)
  }

  function handlePeriodChange(next: Period) {
    if (next === period) return
    setPeriod(next)
    setHistoryError(null)
    setLoadingHistory(true)
  }

  function retryHistory() {
    setHistoryError(null)
    setLoadingHistory(true)
    setReloadKey((value) => value + 1)
  }

  async function handlePredict() {
    const requestId = predictRequest.current + 1
    predictRequest.current = requestId
    setPredicting(true)
    setPredictError(null)

    try {
      const result = await api.predict(selected)
      if (predictRequest.current === requestId) setPrediction(result)
    } catch (error) {
      if (predictRequest.current === requestId) {
        setPrediction(null)
        setPredictError(
          error instanceof Error ? error.message : 'Prediction failed',
        )
      }
    } finally {
      if (predictRequest.current === requestId) setPredicting(false)
    }
  }

  const lastPrice = history?.prices.at(-1)
  const predictDisabled =
    loadingHistory || Boolean(historyError) || !history || !lastPrice

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-6">
        <StockSelector selected={selected} onSelect={handleSelect} />

        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                {stock.symbol}{' '}
                <span className="font-normal text-muted-foreground">
                  · {stock.name}
                </span>
              </h2>
              <p className="text-sm text-muted-foreground">{stock.description}</p>
            </div>
            <PeriodSelector value={period} onChange={handlePeriodChange} />
          </div>

          {loadingHistory && <HistorySkeleton />}

          {!loadingHistory && historyError && (
            <div className="mt-5 rounded-xl border border-loss/25 bg-loss/5 p-4 text-sm text-loss">
              <p className="font-medium">Could not load history.</p>
              <p className="mt-1">{historyError}</p>
              <button
                type="button"
                onClick={retryHistory}
                className="mt-3 rounded-lg bg-loss px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:bg-loss/80"
              >
                Retry
              </button>
            </div>
          )}

          {!loadingHistory && !historyError && history && lastPrice && (
            <>
              <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Stat
                  label="Latest close"
                  value={formatCurrency(lastPrice.close)}
                />
                <Stat label="As of" value={formatDate(lastPrice.date)} />
                <Stat
                  label="Observations"
                  value={String(history.prices.length)}
                />
              </dl>
              <HistoryChart history={history} prediction={prediction} />
            </>
          )}
        </section>

        <EvaluationPanel />
      </div>

      <aside>
        <PredictionPanel
          symbol={selected}
          prediction={prediction}
          predicting={predicting}
          error={predictError}
          disabled={predictDisabled}
          onPredict={handlePredict}
        />
      </aside>
    </div>
  )
}
