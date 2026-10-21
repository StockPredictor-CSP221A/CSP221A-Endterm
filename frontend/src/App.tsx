import { useEffect, useState } from 'react'
import { api } from './services/api'
import type { HealthResponse } from './types'

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .health()
      .then(setHealth)
      .catch((err: Error) => setError(err.message))
  }, [])

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Stock Predictor</h1>
        <p className="text-slate-500">
          Historical prices and ML-powered next-day close forecasts.
        </p>
      </header>

      <section className="rounded-lg border border-slate-200 p-4">
        <h2 className="text-sm font-medium text-slate-500">Backend status</h2>
        {health && (
          <p className="text-emerald-600">
            {health.service} v{health.version} — {health.status}
          </p>
        )}
        {error && <p className="text-rose-600">Unreachable: {error}</p>}
        {!health && !error && <p className="text-slate-400">Checking…</p>}
      </section>

      <p className="text-sm text-slate-400">
        Next: stock search, history chart, and Predict Stock flow.
      </p>
    </main>
  )
}

export default App
