import { useEffect, useRef, useState } from 'react'

import { EvaluationPanel } from './components/EvaluationPanel'
import { HistoryChart } from './components/HistoryChart'
import { PeriodSelector } from './components/PeriodSelector'
import { PredictionPanel } from './components/PredictionPanel'
import { StockSelector } from './components/StockSelector'
import { type Period } from './data/periods'
import { STOCKS, type StockSymbol } from './data/stocks'
import { formatCurrency, formatDate } from './lib/format'
import { api } from './services/api'
import type { HealthResponse, Prediction, StockHistory } from './types'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
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
            className="h-16 animate-pulse rounded-xl bg-slate-100"
          />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-xl bg-slate-100" />
    </div>
  )
}

function App() {
  const [selected, setSelected] = useState<StockSymbol>('SPY')
  const [period, setPeriod] = useState<Period>('1y')
  const [history, setHistory] = useState<StockHistory | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [prediction, setPrediction] = useState<Prediction | null>(null)
  const [predicting, setPredicting] = useState(false)
  const [predictError, setPredictError] = useState<string | null>(null)
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [healthError, setHealthError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const predictRequest = useRef(0)

  const stock = STOCKS.find((item) => item.symbol === selected) ?? STOCKS[0]

  useEffect(() => {
    api
      .health()
      .then(setHealth)
      .catch((error: Error) => setHealthError(error.message))
  }, [])

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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
              CSP221A · Endterm
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Stock Predictor
            </h1>
            <p className="mt-2 max-w-2xl text-slate-600">
              Daily closes for three stocks and a one-trading-day TimesFM
              forecast, evaluated against a naive baseline.
            </p>
          </div>
          <div
            className={`inline-flex items-center gap-2 self-start rounded-full border px-3 py-1.5 text-xs font-medium ${
              healthError
                ? 'border-rose-200 bg-rose-50 text-rose-700'
                : health
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-500'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                healthError
                  ? 'bg-rose-500'
                  : health
                    ? 'bg-emerald-500'
                    : 'bg-slate-300'
              }`}
            />
            {healthError
              ? 'API unreachable'
              : health
                ? `API live · v${health.version}`
                : 'Checking API…'}
          </div>
        </header>

        <main className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-6">
            <StockSelector selected={selected} onSelect={handleSelect} />

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    {stock.symbol}{' '}
                    <span className="font-normal text-slate-500">
                      · {stock.name}
                    </span>
                  </h2>
                  <p className="text-sm text-slate-500">{stock.description}</p>
                </div>
                <PeriodSelector value={period} onChange={handlePeriodChange} />
              </div>

              {loadingHistory && <HistorySkeleton />}

              {!loadingHistory && historyError && (
                <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                  <p className="font-medium">Could not load history.</p>
                  <p className="mt-1">{historyError}</p>
                  <button
                    type="button"
                    onClick={retryHistory}
                    className="mt-3 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700"
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
        </main>

        <footer className="mt-10 border-t border-slate-200 pt-6 text-xs leading-relaxed text-slate-500">
          <p>
            Data: yfinance. Model: Google TimesFM 2.5. Benchmark: SPY, 2025
            out-of-sample. Academic demo only; forecasts are uncertain and not
            financial advice.
          </p>
        </footer>
      </div>
    </div>
  )
}

export default App
