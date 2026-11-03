import { BENCHMARK } from '@/data/benchmark'
import { formatMetric } from '@/lib/format'

function formatDirectional(value: number | null): string {
  return value === null ? '—' : value.toFixed(4)
}

export function EvaluationPanel() {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Evaluation
          </h2>
          <p className="mt-1 text-lg font-semibold">
            Benchmark · {BENCHMARK.asset}
          </p>
          <p className="text-sm text-muted-foreground">
            Out-of-sample {BENCHMARK.testPeriod}
          </p>
        </div>
        <span className="rounded-full bg-gain/10 px-3 py-1 text-xs font-medium text-gain">
          Shipped: TimesFM 2.5
        </span>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-4 font-medium">Model</th>
              <th className="px-3 py-2 text-right font-medium">MAE</th>
              <th className="px-3 py-2 text-right font-medium">RMSE</th>
              <th className="px-3 py-2 text-right font-medium">nMAE</th>
              <th className="px-3 py-2 text-right font-medium">nRMSE</th>
              <th className="py-2 pl-3 text-right font-medium">Dir. acc.</th>
            </tr>
          </thead>
          <tbody>
            {BENCHMARK.rows.map((row) => (
              <tr
                key={row.model}
                className={`border-b border-border last:border-0 ${
                  row.shipped ? 'bg-brand/5' : ''
                }`}
              >
                <td className="py-3 pr-4">
                  <span className="font-medium">{row.model}</span>
                  {row.badge && (
                    <span className="ml-2 rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {row.badge}
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {formatMetric(row.mae)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {formatMetric(row.rmse)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {formatMetric(row.nmae)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {formatMetric(row.nrmse)}
                </td>
                <td className="py-3 pl-3 text-right tabular-nums">
                  {formatDirectional(row.directional)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Lower error is better. The naive baseline has the lowest MAE, but the app
        ships TimesFM 2.5, the best pretrained model, because the project
        requires a real ML forecast. The benchmark covers SPY only; the app also
        serves NVDA and KO. Method: 1,024 past daily closes, one-day horizon,
        zero-shot models, identical split. Directional accuracy is the share of
        correct up/down calls; the naive baseline has no directional signal.
      </p>
    </section>
  )
}
