import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { BENCHMARK } from '@/data/benchmark'
import { formatMetric, formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'

export function ModelPerformanceCard({ className }: { className?: string }) {
  return (
    <Card className={cn('gap-0 py-0', className)}>
      <CardHeader className="border-b border-border py-5">
        <CardTitle className="text-base font-semibold">Model performance</CardTitle>
        <CardDescription>
          {BENCHMARK.asset} out-of-sample test · {BENCHMARK.testPeriod}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="label-caps pl-5">Model</TableHead>
                <TableHead className="label-caps text-right">MAE</TableHead>
                <TableHead className="label-caps text-right">RMSE</TableHead>
                <TableHead className="label-caps hidden text-right sm:table-cell">
                  nMAE
                </TableHead>
                <TableHead className="label-caps pr-5 text-right">Dir. acc.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {BENCHMARK.rows.map((row) => (
                <TableRow key={row.model} className={cn(row.shipped && 'bg-brand/5')}>
                  <TableCell className="pl-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{row.model}</span>
                      {row.badge && (
                        <Badge
                          variant="outline"
                          className={cn(
                            'h-5 text-[10px] uppercase',
                            row.shipped
                              ? 'border-brand/40 text-brand'
                              : 'border-border text-muted-foreground',
                          )}
                        >
                          {row.badge}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatMetric(row.mae)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMetric(row.rmse)}</TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    {formatPercent(row.nmae)}
                  </TableCell>
                  <TableCell className="pr-5 text-right tabular-nums">
                    {row.directional === null ? '—' : formatPercent(row.directional)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="border-t border-border px-5 py-4 text-xs leading-relaxed text-muted-foreground">
          Lower error is better. The naive previous-close baseline has the lowest
          MAE; the app ships TimesFM 2.5, the best pretrained model (1.6% higher
          MAE), because it produces a real model forecast. The benchmark covers SPY
          only. Method: 1,024 past daily closes, one-day horizon, zero-shot models,
          identical chronological split. The naive baseline has no directional
          signal.
        </p>
      </CardContent>
    </Card>
  )
}
