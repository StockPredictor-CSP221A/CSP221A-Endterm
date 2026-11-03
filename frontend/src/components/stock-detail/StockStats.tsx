import { DeltaBadge } from '@/components/common/DeltaBadge'
import { StatCard } from '@/components/common/StatCard'
import { formatCurrency, formatDate, formatSignedCurrency } from '@/lib/format'
import type { HistorySummary } from '@/lib/history'
import { cn } from '@/lib/utils'

interface StockStatsProps {
  summary: HistorySummary
  periodLabel: string
}

function SignedValue({ value }: { value: number }) {
  return (
    <span className={cn(value > 0 && 'text-gain', value < 0 && 'text-loss')}>
      {formatSignedCurrency(value)}
    </span>
  )
}

export function StockStats({ summary, periodLabel }: StockStatsProps) {
  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <StatCard
        label="Last close"
        value={formatCurrency(summary.last.close)}
        hint={formatDate(summary.last.date)}
      />
      <StatCard
        label="Daily change"
        value={summary.dailyChange === null ? '—' : <SignedValue value={summary.dailyChange} />}
        hint={
          summary.dailyChangePercent === null ? undefined : (
            <DeltaBadge percent={summary.dailyChangePercent} />
          )
        }
      />
      <StatCard
        label={`${periodLabel} change`}
        value={<SignedValue value={summary.periodChange} />}
        hint={<DeltaBadge percent={summary.periodChangePercent} />}
      />
      <StatCard label={`${periodLabel} high`} value={formatCurrency(summary.high)} />
      <StatCard label={`${periodLabel} low`} value={formatCurrency(summary.low)} />
      <StatCard
        label="Data points"
        value={summary.count.toLocaleString('en-US')}
        hint="Daily closes"
      />
    </dl>
  )
}
