import { Loader2, RotateCw, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'

import { DeltaBadge } from '@/components/common/DeltaBadge'
import { ErrorState } from '@/components/common/ErrorState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { formatCurrency, formatDate } from '@/lib/format'
import type { Prediction } from '@/types'

interface ForecastCardProps {
  symbol: string
  prediction: Prediction | undefined
  isPending: boolean
  error: string | null
  disabled?: boolean
  onRun: () => void
}

function useElapsedSeconds(active: boolean): number {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    if (!active) return
    const started = Date.now()
    const timer = window.setInterval(
      () => setSeconds(Math.floor((Date.now() - started) / 1000)),
      1000,
    )
    return () => {
      window.clearInterval(timer)
      setSeconds(0)
    }
  }, [active])
  return seconds
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label-caps">{label}</dt>
      <dd className="mt-1 text-sm font-medium tabular-nums">{value}</dd>
    </div>
  )
}

export function ForecastCard({
  symbol,
  prediction,
  isPending,
  error,
  disabled = false,
  onRun,
}: ForecastCardProps) {
  const elapsed = useElapsedSeconds(isPending)
  const delta = prediction ? prediction.predicted_close - prediction.last_observed_close : 0
  const deltaPercent =
    prediction && prediction.last_observed_close !== 0
      ? delta / prediction.last_observed_close
      : 0

  return (
    <Card id="forecast" className="scroll-mt-24 gap-0 p-0">
      <div className="flex items-start justify-between gap-3 border-b border-border p-5">
        <div>
          <p className="label-caps">Forecast</p>
          <h2 className="mt-1 text-base font-semibold">{symbol} · next trading day</h2>
        </div>
        <Badge variant="outline" className="border-brand/40 text-brand">
          TimesFM 2.5
        </Badge>
      </div>

      <div className="p-5" aria-live="polite">
        {isPending && (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="relative flex size-12 items-center justify-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-brand/15" />
              <Loader2 aria-hidden className="size-6 animate-spin text-brand" />
            </div>
            <p className="mt-4 text-sm font-medium">Warming up the forecast model.</p>
            <p className="mt-1 max-w-64 text-sm text-muted-foreground">
              This can take up to a minute after a cold start.
            </p>
            <p className="mt-3 text-xs text-muted-foreground tabular-nums">{elapsed}s elapsed</p>
          </div>
        )}

        {!isPending && error && (
          <ErrorState title="Forecast failed" message={error} />
        )}

        {!isPending && !error && prediction && (
          <div className="space-y-5">
            <div>
              <p className="label-caps">Predicted close · {formatDate(prediction.forecast_date)}</p>
              <p className="mt-1.5 text-4xl font-semibold tracking-tight tabular-nums">
                {formatCurrency(prediction.predicted_close)}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <DeltaBadge percent={deltaPercent} amount={delta} />
                vs. last close
              </div>
            </div>
            <Separator />
            <dl className="grid grid-cols-2 gap-4">
              <Detail label="Last close" value={formatCurrency(prediction.last_observed_close)} />
              <Detail label="As of" value={formatDate(prediction.last_observed_date)} />
              <Detail label="Horizon" value={prediction.forecast_horizon} />
              <Detail label="Model" value={prediction.model_name} />
            </dl>
            {prediction.model_version && (
              <p className="text-xs text-muted-foreground">
                Checkpoint <span className="font-mono">{prediction.model_version}</span>
              </p>
            )}
            <p className="rounded-lg bg-surface px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
              {prediction.disclaimer}
            </p>
          </div>
        )}

        {!isPending && !error && !prediction && (
          <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              Google TimesFM 2.5 reads the last 1,024 daily closes and forecasts the
              close for the next trading day. It runs zero-shot, with no fine-tuning.
            </p>
            <p className="text-xs">
              Forecasts are saved to your history. Forecasts are uncertain and are not
              financial advice.
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-border p-4">
        <Button
          variant={prediction || error ? 'outline' : 'default'}
          className="h-10 w-full"
          onClick={onRun}
          disabled={disabled || isPending}
        >
          {isPending ? (
            <Loader2 aria-hidden className="animate-spin" />
          ) : prediction || error ? (
            <RotateCw aria-hidden />
          ) : (
            <Sparkles aria-hidden />
          )}
          {isPending ? 'Forecasting…' : prediction ? 'Run again' : error ? 'Retry forecast' : 'Run forecast'}
        </Button>
      </div>
    </Card>
  )
}
