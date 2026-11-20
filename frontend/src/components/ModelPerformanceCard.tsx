import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MODEL_METRICS } from '@/data/benchmark'
import { formatMetric, formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'

const STATS = [
  {
    label: 'MAE',
    value: formatMetric(MODEL_METRICS.mae),
    hint: 'Average miss, in dollars',
  },
  {
    label: 'RMSE',
    value: formatMetric(MODEL_METRICS.rmse),
    hint: 'Penalizes large misses more',
  },
  {
    label: 'nMAE',
    value: formatPercent(MODEL_METRICS.nmae),
    hint: 'Average miss as a share of price',
  },
  {
    label: 'Dir. acc.',
    value: formatPercent(MODEL_METRICS.directional),
    hint: 'Correct up/down calls',
  },
]

export function ModelPerformanceCard({ className }: { className?: string }) {
  return (
    <Card className={cn('gap-0 py-0', className)}>
      <CardHeader className="border-b border-border py-5">
        <CardTitle className="text-base font-semibold">Model performance</CardTitle>
        <CardDescription>
          {MODEL_METRICS.model} · {MODEL_METRICS.asset} out-of-sample test ·{' '}
          {MODEL_METRICS.testPeriod}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <dl className="grid grid-cols-2 sm:grid-cols-4">
          {STATS.map((stat) => (
            <div
              key={stat.label}
              className="border-b border-border px-5 py-4 even:border-l sm:border-b-0 sm:border-l sm:first:border-l-0"
            >
              <dt className="label-caps text-muted-foreground">{stat.label}</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums">{stat.value}</dd>
              <dd className="mt-0.5 text-xs text-muted-foreground">{stat.hint}</dd>
            </div>
          ))}
        </dl>
        <p className="border-t border-border px-5 py-4 text-xs leading-relaxed text-muted-foreground">
          Lower error is better. Method: 1,024 past daily closes, one-day horizon,
          zero-shot, chronological split. The test covers SPY only.
        </p>
      </CardContent>
    </Card>
  )
}
