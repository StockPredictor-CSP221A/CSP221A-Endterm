import {
  formatCurrency,
  formatDate,
  formatPercent,
  formatSignedCurrency,
} from '@/lib/format'
import type { Prediction } from '@/types'

interface PredictionPanelProps {
  symbol: string
  prediction: Prediction | null
  predicting: boolean
  error: string | null
  disabled: boolean
  onPredict: () => void
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
      />
    </svg>
  )
}

export function PredictionPanel({
  symbol,
  prediction,
  predicting,
  error,
  disabled,
  onPredict,
}: PredictionPanelProps) {
  const delta = prediction
    ? prediction.predicted_close - prediction.last_observed_close
    : null
  const deltaPercent =
    prediction && delta !== null && prediction.last_observed_close !== 0
      ? delta / prediction.last_observed_close
      : null

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Forecast
          </h2>
          <p className="mt-1 text-lg font-semibold">{symbol} · next trading day</p>
        </div>
        <span className="rounded-full bg-surface px-3 py-1 text-xs font-medium text-muted-foreground">
          TimesFM 2.5
        </span>
      </div>

      <button
        type="button"
        onClick={onPredict}
        disabled={disabled || predicting}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50"
      >
        {predicting && <Spinner />}
        {predicting
          ? 'Forecasting…'
          : prediction
            ? `Re-run ${symbol} forecast`
            : `Predict ${symbol}`}
      </button>

      <div aria-live="polite" className="mt-5">
        {error && (
          <div className="rounded-xl border border-loss/25 bg-loss/5 p-4 text-sm text-loss">
            <p className="font-medium">Forecast failed.</p>
            <p className="mt-1">{error}</p>
          </div>
        )}

        {!error && prediction && (
          <div className="space-y-4">
            <div className="rounded-xl bg-surface p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Predicted close
              </p>
              <p className="mt-1 text-4xl font-semibold tracking-tight">
                {formatCurrency(prediction.predicted_close)}
              </p>
              {delta !== null && deltaPercent !== null && (
                <p
                  className={`mt-1 text-sm font-medium ${
                    delta >= 0 ? 'text-gain' : 'text-loss'
                  }`}
                >
                  {formatSignedCurrency(delta)} ({formatPercent(deltaPercent)})
                  vs. last close
                </p>
              )}
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Forecast date</dt>
                <dd className="font-medium">
                  {formatDate(prediction.forecast_date)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Horizon</dt>
                <dd className="font-medium">{prediction.forecast_horizon}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Last observed</dt>
                <dd className="font-medium">
                  {formatCurrency(prediction.last_observed_close)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">As of</dt>
                <dd className="font-medium">
                  {formatDate(prediction.last_observed_date)}
                </dd>
              </div>
            </dl>

            <p className="text-xs leading-relaxed text-muted-foreground">
              {prediction.disclaimer}
            </p>
          </div>
        )}

        {!error && !prediction && !predicting && (
          <p className="text-sm leading-relaxed text-muted-foreground">
            Run the model for a one-day closing-price forecast. The backend
            fetches five years of daily history for context.
          </p>
        )}

        {!error && !prediction && predicting && (
          <p className="text-sm text-muted-foreground">
            Loading TimesFM and scoring the latest window…
          </p>
        )}
      </div>
    </section>
  )
}
