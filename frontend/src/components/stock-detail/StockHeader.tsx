import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { DeltaBadge } from '@/components/common/DeltaBadge'
import { RoleBadge } from '@/components/stocks/RoleBadge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatDate } from '@/lib/format'
import type { HistorySummary } from '@/lib/history'
import type { StockRole } from '@/types'

interface StockHeaderProps {
  symbol: string
  name: string
  role: StockRole
  description?: string
  summary: HistorySummary | null
  actions?: ReactNode
}

export function StockHeader({
  symbol,
  name,
  role,
  description,
  summary,
  actions,
}: StockHeaderProps) {
  return (
    <div className="space-y-5">
      <Link
        to="/"
        className="inline-flex items-center gap-1 rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ChevronLeft aria-hidden className="size-4" />
        Dashboard
      </Link>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{symbol}</h1>
            <RoleBadge role={role} />
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {name}
            {description ? <span className="hidden sm:inline"> · {description}</span> : null}
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-8">
          <div className="min-h-[60px]">
            {summary ? (
              <>
                <div className="flex flex-wrap items-baseline gap-3">
                  <p className="text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">
                    {formatCurrency(summary.last.close)}
                  </p>
                  {summary.dailyChangePercent !== null && summary.dailyChange !== null && (
                    <DeltaBadge
                      percent={summary.dailyChangePercent}
                      amount={summary.dailyChange}
                      size="md"
                    />
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Close on {formatDate(summary.last.date)}
                </p>
              </>
            ) : (
              <div className="space-y-2">
                <Skeleton className="h-9 w-44" />
                <Skeleton className="h-3 w-28" />
              </div>
            )}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      </div>
    </div>
  )
}
