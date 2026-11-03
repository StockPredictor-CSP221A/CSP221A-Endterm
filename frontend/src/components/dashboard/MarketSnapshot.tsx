import type { ReactNode } from 'react'

import { DeltaBadge } from '@/components/common/DeltaBadge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/format'
import type { HistorySummary } from '@/lib/history'

interface SnapshotRow {
  symbol: string
  summary: HistorySummary
}

interface MarketSnapshotProps {
  rows: SnapshotRow[]
  isLoading: boolean
}

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bg-card px-5 py-4">
      <dt className="label-caps">{label}</dt>
      <dd className="mt-1.5 flex flex-wrap items-center gap-2 text-sm font-semibold">
        {children}
      </dd>
    </div>
  )
}

export function MarketSnapshot({ rows, isLoading }: MarketSnapshotProps) {
  const movers = rows.filter((row) => row.summary.dailyChangePercent !== null)
  const sorted = [...movers].sort(
    (a, b) => (b.summary.dailyChangePercent ?? 0) - (a.summary.dailyChangePercent ?? 0),
  )
  const leader = sorted[0]
  const laggard = sorted.at(-1)
  const average =
    movers.length > 0
      ? movers.reduce((sum, row) => sum + (row.summary.dailyChangePercent ?? 0), 0) /
        movers.length
      : null
  const asOf = rows
    .map((row) => row.summary.last.date)
    .sort()
    .at(-1)

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <h2 className="sr-only">Market snapshot</h2>
      {isLoading && rows.length === 0 ? (
        <div className="grid grid-cols-2 gap-4 p-5 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-10" />
          ))}
        </div>
      ) : (
        <dl className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
          <Cell label="As of">{asOf ? formatDate(asOf) : '—'}</Cell>
          <Cell label="Average move">
            {average !== null ? <DeltaBadge percent={average} /> : '—'}
          </Cell>
          <Cell label="Leader">
            {leader ? (
              <>
                {leader.symbol}
                <DeltaBadge percent={leader.summary.dailyChangePercent ?? 0} />
              </>
            ) : (
              '—'
            )}
          </Cell>
          <Cell label="Laggard">
            {laggard ? (
              <>
                {laggard.symbol}
                <DeltaBadge percent={laggard.summary.dailyChangePercent ?? 0} />
              </>
            ) : (
              '—'
            )}
          </Cell>
        </dl>
      )}
    </Card>
  )
}
