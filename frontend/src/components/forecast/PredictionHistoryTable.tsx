import { Link } from 'react-router-dom'

import { DeltaBadge } from '@/components/common/DeltaBadge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { SavedPrediction } from '@/types'

interface PredictionHistoryTableProps {
  rows: SavedPrediction[]
  /** Hides the model and created columns for tight spaces. */
  compact?: boolean
  showSymbol?: boolean
}

function delta(row: SavedPrediction) {
  const amount = row.predicted_close - row.last_observed_close
  const percent = row.last_observed_close ? amount / row.last_observed_close : 0
  return { amount, percent }
}

function SymbolLink({ symbol }: { symbol: string }) {
  return (
    <Link
      to={`/stocks/${symbol}`}
      className="rounded font-semibold outline-none hover:text-brand focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {symbol}
    </Link>
  )
}

export function PredictionHistoryTable({
  rows,
  compact = false,
  showSymbol = true,
}: PredictionHistoryTableProps) {
  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {showSymbol && <TableHead className="label-caps pl-5">Symbol</TableHead>}
              <TableHead className={cn('label-caps', !showSymbol && 'pl-5')}>
                Forecast date
              </TableHead>
              <TableHead className="label-caps text-right">Predicted</TableHead>
              <TableHead className="label-caps text-right">Last close</TableHead>
              <TableHead className={cn('label-caps text-right', compact && 'pr-5')}>
                Change
              </TableHead>
              {!compact && <TableHead className="label-caps">Model</TableHead>}
              {!compact && <TableHead className="label-caps pr-5 text-right">Created</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const change = delta(row)
              return (
                <TableRow key={row.id}>
                  {showSymbol && (
                    <TableCell className="pl-5">
                      <SymbolLink symbol={row.symbol} />
                    </TableCell>
                  )}
                  <TableCell className={cn(!showSymbol && 'pl-5')}>
                    {formatDate(row.forecast_date)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatCurrency(row.predicted_close)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground tabular-nums">
                    {formatCurrency(row.last_observed_close)}
                  </TableCell>
                  <TableCell className={cn('text-right', compact && 'pr-5')}>
                    <DeltaBadge percent={change.percent} amount={change.amount} />
                  </TableCell>
                  {!compact && (
                    <TableCell className="text-muted-foreground">{row.model_name}</TableCell>
                  )}
                  {!compact && (
                    <TableCell className="pr-5 text-right text-muted-foreground tabular-nums">
                      {formatDateTime(row.created_at)}
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <ul className="divide-y divide-border md:hidden">
        {rows.map((row) => {
          const change = delta(row)
          return (
            <li key={row.id} className="space-y-2 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm">
                  {showSymbol && <SymbolLink symbol={row.symbol} />}
                  <span className="text-muted-foreground">
                    for {formatDate(row.forecast_date)}
                  </span>
                </div>
                <DeltaBadge percent={change.percent} />
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-lg font-semibold tabular-nums">
                  {formatCurrency(row.predicted_close)}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  Last close {formatCurrency(row.last_observed_close)}
                </span>
              </div>
              {!compact && (
                <p className="text-xs text-muted-foreground">
                  {row.model_name} · {formatDateTime(row.created_at)}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}
