import { useId } from 'react'
import { Area, AreaChart, CartesianGrid, ReferenceDot, XAxis, YAxis } from 'recharts'

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { formatCurrency, formatDate, formatShortDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Prediction, PricePoint } from '@/types'

interface PriceChartProps {
  symbol: string
  prices: PricePoint[]
  /** Overlays the forecast as a dashed segment when it continues this series. */
  forecast?: Prediction | null
  className?: string
}

interface ChartRow {
  date: string
  close?: number
  forecast?: number
}

const config = {
  close: { label: 'Close', color: 'var(--brand)' },
  forecast: { label: 'Forecast', color: 'var(--gain)' },
} satisfies ChartConfig

function axisPrice(value: number): string {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`
  return `$${value.toFixed(value < 10 ? 2 : 0)}`
}

function axisDate(iso: string, spanDays: number): string {
  if (spanDays > 400) {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
      month: 'short',
      year: '2-digit',
    })
  }
  return formatShortDate(iso)
}

export function PriceChart({ symbol, prices, forecast, className }: PriceChartProps) {
  const gradientId = useId().replace(/:/g, '')
  const last = prices.at(-1)
  const first = prices[0]
  const spanDays =
    first && last
      ? (new Date(last.date).getTime() - new Date(first.date).getTime()) / 86_400_000
      : 0

  const showForecast = Boolean(
    forecast &&
      last &&
      forecast.symbol === symbol &&
      forecast.last_observed_date === last.date,
  )

  const rows: ChartRow[] = prices.map((point) => ({ date: point.date, close: point.close }))
  if (showForecast && forecast && last) {
    rows[rows.length - 1] = { ...rows[rows.length - 1], forecast: last.close }
    rows.push({ date: forecast.forecast_date, forecast: forecast.predicted_close })
  }

  return (
    <ChartContainer
      config={config}
      className={cn('aspect-auto h-[300px] w-full sm:h-[360px]', className)}
      role="img"
      aria-label={`${symbol} daily closing prices${showForecast ? ' with forecast' : ''}`}
    >
      <AreaChart data={rows} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-close)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--color-close)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          minTickGap={48}
          tickFormatter={(value: string) => axisDate(value, spanDays)}
        />
        <YAxis
          width={56}
          tickLine={false}
          axisLine={false}
          tickMargin={6}
          domain={['auto', 'auto']}
          tickFormatter={(value: number) => axisPrice(value)}
        />
        <ChartTooltip
          cursor={{ stroke: 'var(--muted-foreground)', strokeDasharray: '3 3' }}
          content={
            <ChartTooltipContent
              indicator="line"
              className="min-w-40 bg-popover"
              labelFormatter={(_, payload) => {
                const row = payload?.[0]?.payload as ChartRow | undefined
                return row ? formatDate(row.date) : ''
              }}
              formatter={(value, name) => (
                <div className="flex w-full items-center justify-between gap-4">
                  <span className="text-muted-foreground">
                    {name === 'forecast' ? 'Forecast' : 'Close'}
                  </span>
                  <span className="font-medium tabular-nums text-foreground">
                    {formatCurrency(Number(value))}
                  </span>
                </div>
              )}
            />
          }
        />
        <Area
          dataKey="close"
          type="monotone"
          stroke="var(--color-close)"
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
          isAnimationActive={false}
          connectNulls={false}
        />
        {showForecast && (
          <Area
            dataKey="forecast"
            type="linear"
            stroke="var(--color-forecast)"
            strokeWidth={2}
            strokeDasharray="6 5"
            fill="none"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
            isAnimationActive={false}
            connectNulls={false}
          />
        )}
        {showForecast && forecast && (
          <ReferenceDot
            x={forecast.forecast_date}
            y={forecast.predicted_close}
            r={5}
            fill="var(--gain)"
            stroke="var(--background)"
            strokeWidth={2}
          />
        )}
      </AreaChart>
    </ChartContainer>
  )
}
