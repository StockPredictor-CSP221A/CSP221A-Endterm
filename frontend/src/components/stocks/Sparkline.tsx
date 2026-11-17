import { useId } from 'react'
import { Area, AreaChart, YAxis } from 'recharts'

import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { cn } from '@/lib/utils'
import type { PricePoint } from '@/types'

interface SparklineProps {
  prices: PricePoint[]
  className?: string
}

export function Sparkline({ prices, className }: SparklineProps) {
  const gradientId = useId().replace(/:/g, '')
  const first = prices[0]?.close ?? 0
  const last = prices.at(-1)?.close ?? 0
  const color = last >= first ? 'var(--gain)' : 'var(--loss)'
  const config = { close: { label: 'Close', color } } satisfies ChartConfig

  return (
    <ChartContainer
      config={config}
      className={cn('aspect-auto h-16 w-full', className)}
      aria-hidden
    >
      <AreaChart data={prices} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-close)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--color-close)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis hide domain={['dataMin', 'dataMax']} />
        <Area
          dataKey="close"
          type="monotone"
          stroke="var(--color-close)"
          strokeWidth={1.75}
          fill={`url(#${gradientId})`}
          isAnimationActive={false}
          dot={false}
          activeDot={false}
        />
      </AreaChart>
    </ChartContainer>
  )
}
